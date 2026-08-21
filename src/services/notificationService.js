import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { dispatchNotification } from './notificationChannelService.js'
import { recordNotificationOutboxMetrics } from './metricsService.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000
const OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'EXHAUSTED']

export function enqueueNotification(tx, input) {
	return tx.notificationOutbox.upsert({
		where: { channel_eventKey: { channel: input.channel ?? 'IN_APP', eventKey: input.eventKey } },
		update: {},
		create: {
			channel: input.channel ?? 'IN_APP',
			eventKey: input.eventKey,
			userId: input.userId,
			type: input.type,
			payload: {
				title: input.title.slice(0, 120),
				content: input.content.slice(0, 500),
				referenceType: input.referenceType ?? null,
				referenceId: input.referenceId ?? null,
			},
			maxAttempts: env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
		},
	})
}

export async function listNotifications(userId, query) {
	const where = { userId, ...(query.unreadOnly ? { readAt: null } : {}) }
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.userNotification.count({ where }),
		prisma.userNotification.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function getUnreadCount(userId) {
	return { count: await prisma.userNotification.count({ where: { userId, readAt: null } }) }
}

export async function markNotificationRead(userId, id) {
	await prisma.userNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
	return prisma.userNotification.findFirst({ where: { id, userId } })
}

export async function markAllNotificationsRead(userId) {
	const result = await prisma.userNotification.updateMany({
		where: { userId, readAt: null },
		data: { readAt: new Date() },
	})
	return { updatedCount: result.count }
}

export async function listNotificationOutbox(query) {
	const where = {
		...(query.status ? { status: query.status } : {}),
		...(query.channel ? { channel: query.channel } : {}),
		...(query.userId ? { userId: query.userId } : {}),
		...(query.eventKey ? { eventKey: { contains: query.eventKey } } : {}),
	}
	const skip = (query.page - 1) * query.pageSize
	const [total, items, groups] = await prisma.$transaction([
		prisma.notificationOutbox.count({ where }),
		prisma.notificationOutbox.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { user: { select: { id: true, nickname: true, email: true, phone: true } } },
		}),
		prisma.notificationOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
	])
	const summary = Object.fromEntries(OUTBOX_STATUSES.map((status) => [status, 0]))
	for (const item of groups) summary[item.status] = item._count._all
	return {
		items,
		summary,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function retryNotificationOutbox(id) {
	const changed = await prisma.notificationOutbox.updateMany({
		where: { id, status: { in: ['FAILED', 'EXHAUSTED'] } },
		data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null },
	})
	if (!changed.count) {
		const exists = await prisma.notificationOutbox.count({ where: { id } })
		if (!exists) throw new AppError('通知任务不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		throw new AppError('通知任务当前状态不能重试', { statusCode: 409, code: ERROR_CODES.CONFLICT })
	}
	return prisma.notificationOutbox.findUnique({ where: { id } })
}

async function refreshNotificationOutboxMetrics() {
	const groups = await prisma.notificationOutbox.groupBy({ by: ['status'], _count: { _all: true } })
	recordNotificationOutboxMetrics(Object.fromEntries(groups.map((item) => [item.status, item._count._all])))
}

function retryAt(attempts) {
	const multiplier = 2 ** Math.min(attempts - 1, 6)
	return new Date(Date.now() + env.NOTIFICATION_OUTBOX_RETRY_SECONDS * multiplier * 1000)
}

async function processOne(outbox) {
	const claimed = await prisma.notificationOutbox.updateMany({
		where: { id: outbox.id, status: outbox.status, attempts: outbox.attempts },
		data: { status: 'PROCESSING', attempts: { increment: 1 }, lockedAt: new Date(), lastError: null },
	})
	if (!claimed.count) return false

	try {
		await prisma.$transaction(async (tx) => {
			await dispatchNotification(tx, outbox)
			await tx.notificationOutbox.update({
				where: { id: outbox.id },
				data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastError: null },
			})
		})
		return true
	} catch (error) {
		const attempts = outbox.attempts + 1
		await prisma.notificationOutbox.update({
			where: { id: outbox.id },
			data: {
				status: attempts >= outbox.maxAttempts ? 'EXHAUSTED' : 'FAILED',
				nextAttemptAt: retryAt(attempts),
				lockedAt: null,
				lastError: String(error?.message ?? error).slice(0, 500),
			},
		})
		return false
	}
}

export async function processNotificationOutbox(now = new Date()) {
	const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS)
	const candidates = await prisma.notificationOutbox.findMany({
		where: {
			OR: [
				{ status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
				{ status: 'PROCESSING', lockedAt: { lte: staleBefore } },
			],
		},
		orderBy: { nextAttemptAt: 'asc' },
		take: env.NOTIFICATION_OUTBOX_BATCH_SIZE,
	})
	const runnable = candidates.filter((item) => item.attempts < item.maxAttempts)
	const results = await Promise.allSettled(runnable.map(processOne))
	await refreshNotificationOutboxMetrics()
	return {
		processedCount: results.filter((result) => result.status === 'fulfilled' && result.value).length,
		failedCount: results.filter((result) => result.status === 'rejected' || !result.value).length,
	}
}
