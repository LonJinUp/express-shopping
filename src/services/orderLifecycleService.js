import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { enqueueNotification } from './notificationService.js'

export async function closeExpiredOrder(orderId) {
	return prisma.$transaction(
		async (tx) => {
			const order = await tx.order.findFirst({
				where: { id: orderId, status: 'PENDING_PAYMENT', expiresAt: { lte: new Date() } },
				include: { items: true },
			})
			if (!order) return false
			const changed = await tx.order.updateMany({
				where: { id: order.id, status: 'PENDING_PAYMENT' },
				data: { status: 'CANCELLED', cancelledAt: new Date() },
			})
			if (!changed.count) return false
			if (order.userCouponId) {
				await tx.userCoupon.updateMany({
					where: { id: order.userCouponId, status: 'USED' },
					data: { status: 'AVAILABLE', usedAt: null },
				})
			}
			for (const item of [...order.items].sort((a, b) => a.skuId.localeCompare(b.skuId))) {
				const released = await tx.inventory.updateMany({
					where: { skuId: item.skuId, locked: { gte: item.quantity } },
					data: {
						available: { increment: item.quantity },
						locked: { decrement: item.quantity },
						version: { increment: 1 },
					},
				})
				if (!released.count) throw new AppError('超时订单库存锁定数据异常')
				await tx.inventoryLog.create({
					data: {
						skuId: item.skuId,
						type: 'ORDER_RELEASE',
						availableDiff: item.quantity,
						lockedDiff: -item.quantity,
						referenceType: 'ORDER',
						referenceId: order.id,
						remark: '支付超时释放库存',
					},
				})
			}
			await tx.orderLog.create({
				data: {
					orderId: order.id,
					fromStatus: 'PENDING_PAYMENT',
					toStatus: 'CANCELLED',
					action: 'TIMEOUT_CANCEL',
					remark: '订单支付超时自动关闭',
				},
			})
			return true
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	)
}

export async function closeExpiredOrders(limit = 100) {
	const orders = await prisma.order.findMany({
		where: { status: 'PENDING_PAYMENT', expiresAt: { lte: new Date() } },
		select: { id: true },
		orderBy: { expiresAt: 'asc' },
		take: limit,
	})
	const results = await Promise.allSettled(orders.map(({ id }) => closeExpiredOrder(id)))
	return results.filter((result) => result.status === 'fulfilled' && result.value).length
}

export async function acceptOrder(orderId, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const result = await tx.order.updateMany({
			where: { id: orderId, status: 'PAID', ...(shopId ? { shopId } : {}) },
			data: { status: 'PROCESSING' },
		})
		if (!result.count)
			throw new AppError('订单不存在或当前状态不能接单', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		await tx.orderLog.create({
			data: { orderId, fromStatus: 'PAID', toStatus: 'PROCESSING', action: 'ACCEPT', operatorId, remark: '商家接单' },
		})
		return tx.order.findUnique({ where: { id: orderId } })
	})
}

export async function shipOrder(orderId, input, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const order = await tx.order.findFirst({
			where: { id: orderId, status: 'PROCESSING', ...(shopId ? { shopId } : {}) },
			select: { id: true, userId: true, orderNo: true },
		})
		if (!order) throw new AppError('订单不存在或当前状态不能发货', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		const changed = await tx.order.updateMany({
			where: { id: orderId, status: 'PROCESSING', ...(shopId ? { shopId } : {}) },
			data: { status: 'SHIPPED', shippedAt: new Date() },
		})
		if (!changed.count)
			throw new AppError('订单不存在或当前状态不能发货', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		await tx.shipment.create({ data: { orderId, ...input } })
		await tx.orderLog.create({
			data: {
				orderId,
				fromStatus: 'PROCESSING',
				toStatus: 'SHIPPED',
				action: 'SHIP',
				operatorId,
				remark: `已发货：${input.carrierName} ${input.trackingNumber}`,
			},
		})
		await enqueueNotification(tx, {
			eventKey: `ORDER_SHIPPED:${orderId}`,
			userId: order.userId,
			type: 'ORDER_SHIPPED',
			title: '订单已发货',
			content: `订单 ${order.orderNo} 已由 ${input.carrierName} 发出，运单号 ${input.trackingNumber}。`,
			referenceType: 'ORDER',
			referenceId: orderId,
		})
		return tx.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
	})
}

export async function confirmReceipt(userId, orderId) {
	return prisma.$transaction(async (tx) => {
		const completedAt = new Date()
		const changed = await tx.order.updateMany({
			where: { id: orderId, userId, status: 'SHIPPED' },
			data: { status: 'COMPLETED', completedAt },
		})
		if (!changed.count)
			throw new AppError('订单不存在或当前状态不能确认收货', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		await tx.shipment.updateMany({ where: { orderId, receivedAt: null }, data: { receivedAt: completedAt } })
		await tx.orderLog.create({
			data: {
				orderId,
				fromStatus: 'SHIPPED',
				toStatus: 'COMPLETED',
				action: 'CONFIRM_RECEIPT',
				operatorId: userId,
				remark: '用户确认收货',
			},
		})
		return tx.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
	})
}

export async function autoReceiveOrders(limit = 100) {
	const shippedBefore = new Date(Date.now() - env.ORDER_AUTO_RECEIVE_DAYS * 24 * 60 * 60 * 1000)
	const orders = await prisma.order.findMany({
		where: { status: 'SHIPPED', shippedAt: { lte: shippedBefore } },
		select: { id: true },
		orderBy: { shippedAt: 'asc' },
		take: limit,
	})
	let count = 0
	for (const order of orders) {
		const completedAt = new Date()
		const completed = await prisma.$transaction(async (tx) => {
			const changed = await tx.order.updateMany({
				where: { id: order.id, status: 'SHIPPED' },
				data: { status: 'COMPLETED', completedAt },
			})
			if (!changed.count) return false
			await tx.shipment.updateMany({
				where: { orderId: order.id, receivedAt: null },
				data: { receivedAt: completedAt },
			})
			await tx.orderLog.create({
				data: {
					orderId: order.id,
					fromStatus: 'SHIPPED',
					toStatus: 'COMPLETED',
					action: 'AUTO_RECEIVE',
					remark: '发货超时自动确认收货',
				},
			})
			return true
		})
		if (completed) count += 1
	}
	return count
}
