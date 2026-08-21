import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { createPaymentNo } from '../utils/paymentNo.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { getPaymentChannel, normalizePaymentQueryResult } from './paymentChannelService.js'
import { recordPaymentRevenue } from './merchantFinanceService.js'
import { enqueueNotification, enqueueShopMemberNotifications } from './notificationService.js'

function nextPaymentQueryAt(now = new Date()) {
	return new Date(now.getTime() + env.PAYMENT_QUERY_INTERVAL_SECONDS * 1000)
}

export async function createPayment(userId, input) {
	const channel = input.channel.toUpperCase()
	if (!getPaymentChannel(channel)) {
		throw new AppError('支付渠道未启用', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const existing = await prisma.payment.findUnique({
		where: { orderId_clientRequestId: { orderId: input.orderId, clientRequestId: input.clientRequestId } },
	})
	if (existing) return { payment: existing, duplicated: true }

	try {
		const payment = await prisma.$transaction(async (tx) => {
			const order = await tx.order.findFirst({ where: { id: input.orderId, userId } })
			if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
			if (order.status !== 'PENDING_PAYMENT' || order.expiresAt <= new Date()) {
				throw new AppError('订单当前状态不能支付', { statusCode: 409, code: ERROR_CODES.CONFLICT })
			}
			const activePayment = await tx.payment.findFirst({
				where: { orderId: order.id, status: 'PENDING' },
				orderBy: { createdAt: 'desc' },
			})
			if (activePayment) return activePayment
			return tx.payment.create({
				data: {
					paymentNo: createPaymentNo(),
					orderId: order.id,
					clientRequestId: input.clientRequestId,
					channel,
					amount: order.payableAmount,
					nextQueryAt: nextPaymentQueryAt(),
				},
			})
		})
		return { payment, duplicated: payment.clientRequestId !== input.clientRequestId }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const payment = await prisma.payment.findUnique({
				where: { orderId_clientRequestId: { orderId: input.orderId, clientRequestId: input.clientRequestId } },
			})
			if (payment) return { payment, duplicated: true }
		}
		throw error
	}
}

export async function mockPay(userId, input) {
	const existing = await prisma.payment.findUnique({
		where: { orderId_clientRequestId: { orderId: input.orderId, clientRequestId: input.clientRequestId } },
	})
	if (existing) return { payment: existing, duplicated: true }

	try {
		const payment = await prisma.$transaction(
			async (tx) => {
				const order = await tx.order.findFirst({ where: { id: input.orderId, userId }, include: { items: true } })
				if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
				if (order.status !== 'PENDING_PAYMENT') {
					throw new AppError('订单当前状态不能支付', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}
				if (order.expiresAt <= new Date()) {
					throw new AppError('订单已超过支付时间', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}

				const changed = await tx.order.updateMany({
					where: { id: order.id, status: 'PENDING_PAYMENT' },
					data: { status: 'PAID', paidAmount: order.payableAmount, paidAt: new Date() },
				})
				if (!changed.count)
					throw new AppError('订单状态已变化，请刷新后重试', { statusCode: 409, code: ERROR_CODES.CONFLICT })

				for (const item of [...order.items].sort((a, b) => a.skuId.localeCompare(b.skuId))) {
					const deducted = await tx.inventory.updateMany({
						where: { skuId: item.skuId, locked: { gte: item.quantity } },
						data: { locked: { decrement: item.quantity }, version: { increment: 1 } },
					})
					if (!deducted.count) throw new AppError('订单锁定库存异常')
					await tx.inventoryLog.create({
						data: {
							skuId: item.skuId,
							type: 'ORDER_DEDUCT',
							availableDiff: 0,
							lockedDiff: -item.quantity,
							referenceType: 'ORDER',
							referenceId: order.id,
							operatorId: userId,
							remark: '模拟支付成功扣减锁定库存',
						},
					})
				}

				const created = await tx.payment.create({
					data: {
						paymentNo: createPaymentNo(),
						orderId: order.id,
						clientRequestId: input.clientRequestId,
						channel: 'MOCK',
						status: 'SUCCESS',
						amount: order.payableAmount,
						transactionId: `MOCK-${createPaymentNo()}`,
						paidAt: new Date(),
					},
				})
				await tx.orderLog.create({
					data: {
						orderId: order.id,
						fromStatus: 'PENDING_PAYMENT',
						toStatus: 'PAID',
						action: 'PAY',
						operatorId: userId,
						remark: '模拟支付成功',
					},
				})
				await recordPaymentRevenue(tx, created.id)
				await enqueueNotification(tx, {
					eventKey: `ORDER_PAID:${order.id}`,
					userId: order.userId,
					type: 'ORDER_PAID',
					title: '订单支付成功',
					content: `订单 ${order.orderNo} 已支付成功，商家将尽快处理。`,
					referenceType: 'ORDER',
					referenceId: order.id,
				})
				await enqueueShopMemberNotifications(tx, {
					shopId: order.shopId,
					eventKey: `MERCHANT_ORDER_PAID:${order.id}`,
					type: 'MERCHANT_ORDER_PAID',
					title: '有新的已付款订单',
					content: `订单 ${order.orderNo} 已付款，实付 ${order.payableAmount} 分，请及时接单处理。`,
					referenceType: 'ORDER',
					referenceId: order.id,
				})
				return created
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { payment, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const payment = await prisma.payment.findUnique({
				where: { orderId_clientRequestId: { orderId: input.orderId, clientRequestId: input.clientRequestId } },
			})
			if (payment) return { payment, duplicated: true }
		}
		throw error
	}
}

async function applySuccessfulPayment(tx, payment, transactionId, remark) {
	const order = await tx.order.findUnique({ where: { id: payment.orderId }, include: { items: true } })
	if (!order) throw new AppError('支付关联订单不存在')
	if (payment.amount !== order.payableAmount) {
		throw new AppError('支付金额与订单应付金额不一致', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	if (order.status === 'PAID' || ['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(order.status)) return
	if (order.status !== 'PENDING_PAYMENT') {
		throw new AppError('订单状态不能接收支付结果', { statusCode: 409, code: ERROR_CODES.CONFLICT })
	}

	const paidAt = new Date()
	const changed = await tx.order.updateMany({
		where: { id: order.id, status: 'PENDING_PAYMENT' },
		data: { status: 'PAID', paidAmount: payment.amount, paidAt },
	})
	if (!changed.count) throw new AppError('订单状态已变化', { statusCode: 409, code: ERROR_CODES.CONFLICT })

	for (const item of [...order.items].sort((a, b) => a.skuId.localeCompare(b.skuId))) {
		const deducted = await tx.inventory.updateMany({
			where: { skuId: item.skuId, locked: { gte: item.quantity } },
			data: { locked: { decrement: item.quantity }, version: { increment: 1 } },
		})
		if (!deducted.count) throw new AppError('订单锁定库存异常')
		await tx.inventoryLog.create({
			data: {
				skuId: item.skuId,
				type: 'ORDER_DEDUCT',
				availableDiff: 0,
				lockedDiff: -item.quantity,
				referenceType: 'ORDER',
				referenceId: order.id,
				remark,
			},
		})
	}
	await tx.payment.update({
		where: { id: payment.id },
		data: { status: 'SUCCESS', transactionId, paidAt },
	})
	await recordPaymentRevenue(tx, payment.id)
	await tx.orderLog.create({
		data: { orderId: order.id, fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID', action: 'PAY_CALLBACK', remark },
	})
	await enqueueNotification(tx, {
		eventKey: `ORDER_PAID:${order.id}`,
		userId: order.userId,
		type: 'ORDER_PAID',
		title: '订单支付成功',
		content: `订单 ${order.orderNo} 已支付成功，商家将尽快处理。`,
		referenceType: 'ORDER',
		referenceId: order.id,
	})
	await enqueueShopMemberNotifications(tx, {
		shopId: order.shopId,
		eventKey: `MERCHANT_ORDER_PAID:${order.id}`,
		type: 'MERCHANT_ORDER_PAID',
		title: '有新的已付款订单',
		content: `订单 ${order.orderNo} 已付款，实付 ${order.payableAmount} 分，请及时接单处理。`,
		referenceType: 'ORDER',
		referenceId: order.id,
	})
}

export async function processCallback(channel, payload) {
	const duplicate = await prisma.paymentCallbackLog.findUnique({
		where: { channel_eventId: { channel, eventId: payload.eventId } },
	})
	if (duplicate) return { accepted: duplicate.status === 'PROCESSED', duplicated: true }

	try {
		return await prisma.$transaction(
			async (tx) => {
				const callback = await tx.paymentCallbackLog.create({
					data: { channel, eventId: payload.eventId, payload, status: 'RECEIVED' },
				})
				const payment = await tx.payment.findUnique({ where: { paymentNo: payload.paymentNo } })
				if (!payment) {
					await tx.paymentCallbackLog.update({
						where: { id: callback.id },
						data: { status: 'REJECTED', processedAt: new Date(), errorMessage: '支付单不存在' },
					})
					return { accepted: false, duplicated: false }
				}
				if (payment.channel !== channel || payment.amount !== payload.amount) {
					await tx.paymentCallbackLog.update({
						where: { id: callback.id },
						data: {
							paymentId: payment.id,
							status: 'REJECTED',
							processedAt: new Date(),
							errorMessage: '渠道或金额不匹配',
						},
					})
					return { accepted: false, duplicated: false }
				}

				if (payload.status === 'SUCCESS') {
					await applySuccessfulPayment(tx, payment, payload.transactionId, `${channel} 支付回调成功`)
				} else if (payment.status === 'PENDING') {
					await tx.payment.update({
						where: { id: payment.id },
						data: { status: 'FAILED', transactionId: payload.transactionId },
					})
				}
				await tx.paymentCallbackLog.update({
					where: { id: callback.id },
					data: { paymentId: payment.id, status: 'PROCESSED', processedAt: new Date() },
				})
				return { accepted: true, duplicated: false }
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const callback = await prisma.paymentCallbackLog.findUnique({
				where: { channel_eventId: { channel, eventId: payload.eventId } },
			})
			if (callback) return { accepted: callback.status === 'PROCESSED', duplicated: true }
		}
		throw error
	}
}

async function applyPaymentQueryResult(paymentId, result) {
	return prisma.$transaction(
		async (tx) => {
			const payment = await tx.payment.findUnique({ where: { id: paymentId } })
			if (!payment || payment.status !== 'PENDING') return false
			if (result.status === 'SUCCESS') {
				await applySuccessfulPayment(tx, payment, result.transactionId, `${payment.channel} 支付主动查询成功`)
				return true
			}
			if (['FAILED', 'NOT_FOUND'].includes(result.status)) {
				await tx.payment.update({
					where: { id: payment.id },
					data: { status: 'FAILED', queryError: result.message },
				})
				return true
			}
			await tx.payment.update({
				where: { id: payment.id },
				data: { queryError: result.message },
			})
			return false
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	)
}

export async function reconcilePendingPayments(now = new Date()) {
	const candidates = await prisma.payment.findMany({
		where: {
			status: 'PENDING',
			nextQueryAt: { lte: now },
			queryCount: { lt: env.PAYMENT_QUERY_MAX_ATTEMPTS },
		},
		orderBy: { nextQueryAt: 'asc' },
		take: env.PAYMENT_QUERY_BATCH_SIZE,
	})
	const result = { scannedCount: candidates.length, queriedCount: 0, resolvedCount: 0, skippedCount: 0, failedCount: 0 }

	for (const payment of candidates) {
		const adapter = getPaymentChannel(payment.channel)
		if (!adapter) {
			result.skippedCount += 1
			continue
		}
		const claimed = await prisma.payment.updateMany({
			where: { id: payment.id, status: 'PENDING', nextQueryAt: { lte: now }, queryCount: payment.queryCount },
			data: {
				queryCount: { increment: 1 },
				lastQueriedAt: now,
				nextQueryAt: nextPaymentQueryAt(now),
				queryError: null,
			},
		})
		if (!claimed.count) continue
		result.queriedCount += 1
		try {
			const queryResult = normalizePaymentQueryResult(await adapter.queryPayment(payment))
			if (await applyPaymentQueryResult(payment.id, queryResult)) result.resolvedCount += 1
		} catch (error) {
			result.failedCount += 1
			logger.warn({ err: error, paymentId: payment.id, channel: payment.channel }, '支付主动查询失败')
			await prisma.payment.updateMany({
				where: { id: payment.id, status: 'PENDING' },
				data: { queryError: '支付渠道查询暂时失败' },
			})
		}
	}
	await prisma.payment.updateMany({
		where: { status: 'PENDING', queryCount: { gte: env.PAYMENT_QUERY_MAX_ATTEMPTS } },
		data: { queryError: '主动查询已达最大次数，需要人工核对' },
	})
	return result
}
