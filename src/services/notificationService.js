import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { dispatchNotification } from './notificationChannelService.js'

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000

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
				title: input.title,
				content: input.content,
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
	return {
		processedCount: results.filter((result) => result.status === 'fulfilled' && result.value).length,
		failedCount: results.filter((result) => result.status === 'rejected' || !result.value).length,
	}
}
