import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { createAfterSaleNo, createRefundNo } from '../utils/transactionNo.js'
import { buildAfterSaleOverdueWhere } from './afterSaleReminderService.js'
import { calculateAfterSaleAmount } from './refundCalculationService.js'

const activeStatuses = ['PENDING', 'APPROVED', 'WAITING_RETURN', 'RETURNED', 'REFUNDING']
const applicableOrderStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED']
const detailInclude = {
	items: { include: { orderItem: true } },
	logs: { orderBy: { createdAt: 'asc' } },
	refund: true,
	order: { select: { orderNo: true, status: true, paidAmount: true, refundedAmount: true } },
}

function shopScope(shopId) {
	return shopId ? { order: { shopId } } : {}
}

async function findRefundByRequest(clientRequestId, shopId) {
	const refund = await prisma.refund.findUnique({ where: { clientRequestId } })
	if (!refund) return null
	if (shopId) {
		const belongsToShop = await prisma.afterSale.count({ where: { id: refund.afterSaleId, order: { shopId } } })
		if (!belongsToShop) {
			throw new AppError('退款幂等键已被使用', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		}
	}
	return refund
}

export async function createAfterSale(userId, input) {
	const existing = await prisma.afterSale.findUnique({
		where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
		include: detailInclude,
	})
	if (existing) return { afterSale: existing, duplicated: true }

	try {
		const afterSale = await prisma.$transaction(
			async (tx) => {
				const order = await tx.order.findFirst({ where: { id: input.orderId, userId }, include: { items: true } })
				if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
				if (!applicableOrderStatuses.includes(order.status)) {
					throw new AppError('当前订单状态不能申请售后', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}
				if (input.type === 'REFUND_ONLY' && ['SHIPPED', 'COMPLETED'].includes(order.status)) {
					throw new AppError('已发货订单应申请退货退款', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
				}
				if (input.type === 'RETURN_REFUND' && !['SHIPPED', 'COMPLETED'].includes(order.status)) {
					throw new AppError('未发货订单应申请仅退款', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
				}
				const active = await tx.afterSale.findFirst({
					where: { orderId: order.id, status: { in: activeStatuses } },
					select: { id: true },
				})
				if (active) throw new AppError('该订单已有进行中的售后', { statusCode: 409, code: ERROR_CODES.CONFLICT })

				const requestedOrderItemIds = input.items.map((item) => item.orderItemId)
				const previousItems = await tx.afterSaleItem.findMany({
					where: {
						orderItemId: { in: requestedOrderItemIds },
						afterSale: { orderId: order.id, status: { notIn: ['REJECTED', 'CANCELLED'] } },
					},
					select: { orderItemId: true, quantity: true },
				})
				const previousQuantityByItem = previousItems.reduce((result, item) => {
					result.set(item.orderItemId, (result.get(item.orderItemId) ?? 0) + item.quantity)
					return result
				}, new Map())
				for (const requested of input.items) {
					const orderItem = order.items.find((item) => item.id === requested.orderItemId)
					if (orderItem && (previousQuantityByItem.get(orderItem.id) ?? 0) + requested.quantity > orderItem.quantity) {
						throw new AppError('累计售后数量超过购买数量', {
							statusCode: 422,
							code: ERROR_CODES.VALIDATION_ERROR,
						})
					}
				}

				const calculation = calculateAfterSaleAmount(order, input.items, previousQuantityByItem)
				const remainingRefundable = order.paidAmount - order.refundedAmount
				if (calculation.requestedAmount <= 0 || calculation.requestedAmount > remainingRefundable) {
					throw new AppError('申请退款金额超过订单剩余可退金额', {
						statusCode: 422,
						code: ERROR_CODES.VALIDATION_ERROR,
					})
				}
				const created = await tx.afterSale.create({
					data: {
						afterSaleNo: createAfterSaleNo(),
						clientRequestId: input.clientRequestId,
						orderId: order.id,
						userId,
						type: input.type,
						previousOrderStatus: order.status,
						reason: input.reason,
						description: input.description,
						requestedAmount: calculation.requestedAmount,
						items: {
							create: calculation.items.map(({ orderItemId, quantity, refundAmount }) => ({
								orderItemId,
								quantity,
								refundAmount,
							})),
						},
						logs: { create: { toStatus: 'PENDING', action: 'APPLY', operatorId: userId, remark: input.reason } },
					},
				})
				await tx.order.update({ where: { id: order.id }, data: { status: 'AFTER_SALE' } })
				await tx.orderLog.create({
					data: {
						orderId: order.id,
						fromStatus: order.status,
						toStatus: 'AFTER_SALE',
						action: 'AFTER_SALE_APPLY',
						operatorId: userId,
						remark: input.reason,
					},
				})
				return tx.afterSale.findUnique({ where: { id: created.id }, include: detailInclude })
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { afterSale, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const afterSale = await prisma.afterSale.findUnique({
				where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
				include: detailInclude,
			})
			if (afterSale) return { afterSale, duplicated: true }
		}
		throw error
	}
}

export async function listAfterSales(userId, query) {
	const where = { userId, ...(query.status ? { status: query.status } : {}) }
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.afterSale.count({ where }),
		prisma.afterSale.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { items: { include: { orderItem: true } }, refund: true },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function listAdminAfterSales(query, shopId) {
	const where = { ...shopScope(shopId), ...(query.status ? { status: query.status } : {}) }
	const skip = (query.page - 1) * query.pageSize
	const [total, items, pendingCount, overdueCount] = await prisma.$transaction([
		prisma.afterSale.count({ where }),
		prisma.afterSale.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: {
				user: { select: { id: true, nickname: true, email: true, phone: true } },
				order: { select: { orderNo: true } },
				items: { include: { orderItem: true } },
				refund: true,
			},
		}),
		prisma.afterSale.count({
			where: { ...shopScope(shopId), status: { in: ['PENDING', 'RETURNED', 'REFUNDING'] } },
		}),
		prisma.afterSale.count({ where: { ...shopScope(shopId), ...buildAfterSaleOverdueWhere() } }),
	])
	return {
		items,
		pendingCount,
		overdueCount,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function getAdminAfterSale(id, shopId) {
	const item = await prisma.afterSale.findFirst({
		where: { id, ...shopScope(shopId) },
		include: { ...detailInclude, user: { select: { id: true, nickname: true, email: true, phone: true } } },
	})
	if (!item) throw new AppError('售后单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return item
}

export async function processRefundCallback(channel, payload) {
	const duplicate = await prisma.refundCallbackLog.findUnique({
		where: { channel_eventId: { channel, eventId: payload.eventId } },
	})
	if (duplicate) return { accepted: duplicate.status === 'PROCESSED', duplicated: true }

	try {
		return await prisma.$transaction(async (tx) => {
			const callback = await tx.refundCallbackLog.create({ data: { channel, eventId: payload.eventId, payload } })
			const refund = await tx.refund.findUnique({
				where: { refundNo: payload.refundNo },
				include: {
					afterSale: { include: { items: { include: { orderItem: true } }, order: true } },
				},
			})
			if (!refund || refund.channel !== channel || refund.amount !== payload.amount) {
				await tx.refundCallbackLog.update({
					where: { id: callback.id },
					data: {
						refundId: refund?.id,
						status: 'REJECTED',
						errorMessage: '退款单、渠道或金额不匹配',
						processedAt: new Date(),
					},
				})
				return { accepted: false, duplicated: false }
			}
			if (refund.status !== 'PENDING') {
				await tx.refundCallbackLog.update({
					where: { id: callback.id },
					data: { refundId: refund.id, status: 'PROCESSED', processedAt: new Date() },
				})
				return { accepted: true, duplicated: false }
			}
			if (refund.afterSale.status !== 'REFUNDING') {
				await tx.refundCallbackLog.update({
					where: { id: callback.id },
					data: {
						refundId: refund.id,
						status: 'REJECTED',
						errorMessage: '售后单不在退款中状态',
						processedAt: new Date(),
					},
				})
				return { accepted: false, duplicated: false }
			}
			if (payload.status === 'SUCCESS') {
				await completeRefund(tx, refund, refund.afterSale, null, payload.transactionId, '退款渠道回调成功')
			} else {
				await tx.refund.update({
					where: { id: refund.id },
					data: { status: 'FAILED', transactionId: payload.transactionId, errorMessage: '退款渠道处理失败' },
				})
				await tx.afterSaleLog.create({
					data: {
						afterSaleId: refund.afterSaleId,
						fromStatus: 'REFUNDING',
						toStatus: 'REFUNDING',
						action: 'REFUND_FAILED',
						remark: '退款渠道处理失败，可重新发起',
					},
				})
			}
			await tx.refundCallbackLog.update({
				where: { id: callback.id },
				data: { refundId: refund.id, status: 'PROCESSED', processedAt: new Date() },
			})
			return { accepted: true, duplicated: false }
		})
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const callback = await prisma.refundCallbackLog.findUnique({
				where: { channel_eventId: { channel, eventId: payload.eventId } },
			})
			if (callback) return { accepted: callback.status === 'PROCESSED', duplicated: true }
		}
		throw error
	}
}

export async function getAfterSale(userId, id) {
	const item = await prisma.afterSale.findFirst({ where: { id, userId }, include: detailInclude })
	if (!item) throw new AppError('售后单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return item
}

export async function submitReturnShipment(userId, id, input) {
	return prisma.$transaction(async (tx) => {
		const changed = await tx.afterSale.updateMany({
			where: { id, userId, status: 'WAITING_RETURN', type: 'RETURN_REFUND' },
			data: {
				status: 'RETURNED',
				remindedAt: null,
				returnCarrierCode: input.carrierCode,
				returnCarrierName: input.carrierName,
				returnTrackingNumber: input.trackingNumber,
			},
		})
		if (!changed.count)
			throw new AppError('售后单不存在或当前状态不能填写物流', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		await tx.afterSaleLog.create({
			data: {
				afterSaleId: id,
				fromStatus: 'WAITING_RETURN',
				toStatus: 'RETURNED',
				action: 'RETURN_SHIP',
				operatorId: userId,
				remark: `${input.carrierName} ${input.trackingNumber}`,
			},
		})
		return tx.afterSale.findUnique({ where: { id }, include: detailInclude })
	})
}

export async function reviewAfterSale(id, input, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const item = await tx.afterSale.findFirst({ where: { id, ...shopScope(shopId) } })
		if (!item || item.status !== 'PENDING')
			throw new AppError('售后单不存在或已审核', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		if (input.action === 'REJECT') {
			await tx.afterSale.update({ where: { id }, data: { status: 'REJECTED', merchantRemark: input.remark } })
			await tx.order.update({ where: { id: item.orderId }, data: { status: item.previousOrderStatus } })
			await tx.afterSaleLog.create({
				data: {
					afterSaleId: id,
					fromStatus: 'PENDING',
					toStatus: 'REJECTED',
					action: 'REJECT',
					operatorId,
					remark: input.remark,
				},
			})
			await tx.orderLog.create({
				data: {
					orderId: item.orderId,
					fromStatus: 'AFTER_SALE',
					toStatus: item.previousOrderStatus,
					action: 'AFTER_SALE_REJECT',
					operatorId,
					remark: input.remark,
				},
			})
			return tx.afterSale.findUnique({ where: { id }, include: detailInclude })
		}
		const approvedAmount = input.approvedAmount ?? item.requestedAmount
		if (approvedAmount <= 0 || approvedAmount > item.requestedAmount)
			throw new AppError('核准退款金额无效', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		const nextStatus = item.type === 'RETURN_REFUND' ? 'WAITING_RETURN' : 'REFUNDING'
		await tx.afterSale.update({
			where: { id },
			data: { status: nextStatus, approvedAmount, merchantRemark: input.remark, remindedAt: null },
		})
		await tx.order.update({
			where: { id: item.orderId },
			data: { status: item.type === 'RETURN_REFUND' ? 'AFTER_SALE' : 'REFUNDING' },
		})
		await tx.afterSaleLog.create({
			data: {
				afterSaleId: id,
				fromStatus: 'PENDING',
				toStatus: nextStatus,
				action: 'APPROVE',
				operatorId,
				remark: input.remark,
			},
		})
		return tx.afterSale.findUnique({ where: { id }, include: detailInclude })
	})
}

export async function confirmReturn(id, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const item = await tx.afterSale.findFirst({
			where: { id, ...shopScope(shopId) },
			include: { items: { include: { orderItem: true } } },
		})
		if (!item || item.status !== 'RETURNED')
			throw new AppError('售后单不存在或尚未收到退货', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		const now = new Date()
		if (!item.stockReturnedAt) {
			for (const saleItem of item.items) {
				await tx.inventory.update({
					where: { skuId: saleItem.orderItem.skuId },
					data: { available: { increment: saleItem.quantity }, version: { increment: 1 } },
				})
				await tx.inventoryLog.create({
					data: {
						skuId: saleItem.orderItem.skuId,
						type: 'AFTER_SALE_RETURN',
						availableDiff: saleItem.quantity,
						lockedDiff: 0,
						referenceType: 'AFTER_SALE',
						referenceId: item.id,
						operatorId,
						remark: '商家确认收到退货，库存返还',
					},
				})
			}
		}
		await tx.afterSale.update({
			where: { id },
			data: { status: 'REFUNDING', stockReturnedAt: now, remindedAt: null },
		})
		await tx.order.update({ where: { id: item.orderId }, data: { status: 'REFUNDING' } })
		await tx.afterSaleLog.create({
			data: {
				afterSaleId: id,
				fromStatus: 'RETURNED',
				toStatus: 'REFUNDING',
				action: 'CONFIRM_RETURN',
				operatorId,
				remark: '商家确认收到退货',
			},
		})
		return tx.afterSale.findUnique({ where: { id }, include: detailInclude })
	})
}

async function returnStock(tx, afterSale, operatorId, remark) {
	if (afterSale.stockReturnedAt) return
	for (const saleItem of afterSale.items) {
		await tx.inventory.update({
			where: { skuId: saleItem.orderItem.skuId },
			data: { available: { increment: saleItem.quantity }, version: { increment: 1 } },
		})
		await tx.inventoryLog.create({
			data: {
				skuId: saleItem.orderItem.skuId,
				type: 'AFTER_SALE_RETURN',
				availableDiff: saleItem.quantity,
				lockedDiff: 0,
				referenceType: 'AFTER_SALE',
				referenceId: afterSale.id,
				operatorId,
				remark,
			},
		})
	}
	await tx.afterSale.update({ where: { id: afterSale.id }, data: { stockReturnedAt: new Date() } })
}

async function restoreCoupon(tx, order) {
	if (!order.userCouponId) return
	const userCoupon = await tx.userCoupon.findUnique({
		where: { id: order.userCouponId },
		include: { coupon: true },
	})
	if (!userCoupon) return
	await tx.userCoupon.update({
		where: { id: userCoupon.id },
		data: { status: userCoupon.coupon.endsAt >= new Date() ? 'AVAILABLE' : 'EXPIRED', usedAt: null },
	})
}

async function completeRefund(tx, refund, afterSale, operatorId, transactionId, remark) {
	const refundedAmount = afterSale.order.refundedAmount + refund.amount
	if (refundedAmount > afterSale.order.paidAmount) {
		throw new AppError('累计退款金额超过订单实付金额', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const isFullRefund = refundedAmount === afterSale.order.paidAmount
	if (afterSale.type === 'REFUND_ONLY') await returnStock(tx, afterSale, operatorId, remark)
	await tx.refund.update({
		where: { id: refund.id },
		data: { status: 'SUCCESS', transactionId, refundedAt: new Date(), errorMessage: null },
	})
	await tx.payment.update({
		where: { id: refund.paymentId },
		data: { status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
	})
	await tx.order.update({
		where: { id: afterSale.orderId },
		data: { refundedAmount, status: isFullRefund ? 'REFUNDED' : afterSale.previousOrderStatus },
	})
	await tx.afterSale.update({
		where: { id: afterSale.id },
		data: { status: 'COMPLETED', completedAt: new Date() },
	})
	await tx.afterSaleLog.create({
		data: {
			afterSaleId: afterSale.id,
			fromStatus: 'REFUNDING',
			toStatus: 'COMPLETED',
			action: 'REFUND_SUCCESS',
			operatorId,
			remark: `${remark}：${refund.amount} 分`,
		},
	})
	await tx.orderLog.create({
		data: {
			orderId: afterSale.orderId,
			fromStatus: 'REFUNDING',
			toStatus: isFullRefund ? 'REFUNDED' : afterSale.previousOrderStatus,
			action: 'REFUND_SUCCESS',
			operatorId,
			remark: `退款成功：${refund.amount} 分`,
		},
	})
	if (isFullRefund) await restoreCoupon(tx, afterSale.order)
}

export async function createRefund(id, input, operatorId, shopId) {
	const existing = await findRefundByRequest(input.clientRequestId, shopId)
	if (existing) return { refund: existing, duplicated: true }

	try {
		const refund = await prisma.$transaction(
			async (tx) => {
				const afterSale = await tx.afterSale.findFirst({
					where: { id, ...shopScope(shopId) },
					include: { order: true, refund: true },
				})
				if (!afterSale || afterSale.status !== 'REFUNDING' || !afterSale.approvedAmount) {
					throw new AppError('售后单不存在或当前状态不能退款', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}
				if (afterSale.refund) {
					throw new AppError('该售后单已有退款单', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}
				if (afterSale.order.refundedAmount + afterSale.approvedAmount > afterSale.order.paidAmount) {
					throw new AppError('累计退款金额超过订单实付金额', {
						statusCode: 422,
						code: ERROR_CODES.VALIDATION_ERROR,
					})
				}
				const payment = await tx.payment.findFirst({
					where: { orderId: afterSale.orderId, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } },
					orderBy: { paidAt: 'desc' },
				})
				if (!payment) throw new AppError('订单没有可退款的支付记录', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				const created = await tx.refund.create({
					data: {
						refundNo: createRefundNo(),
						afterSaleId: afterSale.id,
						paymentId: payment.id,
						clientRequestId: input.clientRequestId,
						channel: input.channel,
						amount: afterSale.approvedAmount,
						lastAttemptAt: new Date(),
					},
				})
				await tx.afterSale.update({ where: { id }, data: { remindedAt: null } })
				await tx.afterSaleLog.create({
					data: {
						afterSaleId: id,
						fromStatus: 'REFUNDING',
						toStatus: 'REFUNDING',
						action: 'REFUND_CREATED',
						operatorId,
						remark: `已创建 ${input.channel} 退款单`,
					},
				})
				return created
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { refund, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const refund = await findRefundByRequest(input.clientRequestId, shopId)
			if (refund) return { refund, duplicated: true }
		}
		throw error
	}
}

export async function retryRefund(id, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const refund = await tx.refund.findFirst({
			where: { afterSaleId: id, ...(shopId ? { afterSale: shopScope(shopId) } : {}) },
			include: { afterSale: true },
		})
		if (!refund || refund.status !== 'FAILED' || refund.afterSale.status !== 'REFUNDING') {
			throw new AppError('退款单不存在或当前状态不能重试', { statusCode: 409, code: ERROR_CODES.CONFLICT })
		}
		const updated = await tx.refund.update({
			where: { id: refund.id },
			data: {
				status: 'PENDING',
				errorMessage: null,
				transactionId: null,
				retryCount: { increment: 1 },
				lastAttemptAt: new Date(),
			},
		})
		await tx.afterSale.update({ where: { id }, data: { remindedAt: null } })
		await tx.afterSaleLog.create({
			data: {
				afterSaleId: id,
				fromStatus: 'REFUNDING',
				toStatus: 'REFUNDING',
				action: 'REFUND_RETRY',
				operatorId,
				remark: `第 ${updated.retryCount} 次重试退款`,
			},
		})
		return updated
	})
}

export async function remindOverdueAfterSales(limit = 100) {
	const items = await prisma.afterSale.findMany({
		where: buildAfterSaleOverdueWhere(new Date(), undefined, true),
		select: { id: true, status: true },
		orderBy: { updatedAt: 'asc' },
		take: limit,
	})
	let remindedCount = 0
	for (const item of items) {
		await prisma.$transaction(async (tx) => {
			const changed = await tx.afterSale.updateMany({
				where: { id: item.id, status: item.status, remindedAt: null },
				data: { remindedAt: new Date() },
			})
			if (!changed.count) return
			await tx.afterSaleLog.create({
				data: {
					afterSaleId: item.id,
					fromStatus: item.status,
					toStatus: item.status,
					action: 'OVERDUE_REMINDER',
					remark: '售后单已超过当前处理时限',
				},
			})
			remindedCount += 1
		})
	}
	return remindedCount
}

export async function mockRefund(id, clientRequestId, operatorId, shopId) {
	const existing = await findRefundByRequest(clientRequestId, shopId)
	if (existing) return { refund: existing, duplicated: true }

	try {
		const refund = await prisma.$transaction(
			async (tx) => {
				const afterSale = await tx.afterSale.findFirst({
					where: { id, ...shopScope(shopId) },
					include: { items: { include: { orderItem: true } }, order: true },
				})
				if (!afterSale || afterSale.status !== 'REFUNDING' || !afterSale.approvedAmount) {
					throw new AppError('售后单不存在或当前状态不能退款', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}
				const payment = await tx.payment.findFirst({
					where: { orderId: afterSale.orderId, status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } },
					orderBy: { paidAt: 'desc' },
				})
				if (!payment) throw new AppError('订单没有可退款的支付记录', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				const amount = afterSale.approvedAmount
				if (afterSale.order.refundedAmount + amount > afterSale.order.paidAmount) {
					throw new AppError('累计退款金额超过订单实付金额', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
				}

				const created = await tx.refund.create({
					data: {
						refundNo: createRefundNo(),
						afterSaleId: afterSale.id,
						paymentId: payment.id,
						clientRequestId,
						channel: 'MOCK',
						status: 'SUCCESS',
						amount,
						transactionId: `MOCK-${createRefundNo()}`,
						refundedAt: new Date(),
					},
				})
				await completeRefund(tx, created, afterSale, operatorId, created.transactionId, '模拟退款成功')
				return created
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { refund, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const refund = await findRefundByRequest(clientRequestId, shopId)
			if (refund) return { refund, duplicated: true }
		}
		throw error
	}
}
