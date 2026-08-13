import { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { createOrderNo } from '../utils/orderNo.js'
import { calculatePricing } from './pricingService.js'

const orderDetailInclude = {
	address: true,
	items: true,
	logs: { orderBy: { createdAt: 'asc' } },
	payments: true,
	shipment: true,
	userCoupon: { include: { coupon: true } },
}

function invalidOrderItem(message = '商品已失效或库存不足') {
	return new AppError(message, { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
}

async function loadPurchaseItems(tx, userId, input) {
	if (input.source === 'CART') {
		const cartItems = await tx.cartItem.findMany({
			where: { id: { in: input.cartItemIds }, userId, selected: true },
			include: {
				sku: { include: { product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } } },
			},
		})
		if (cartItems.length !== new Set(input.cartItemIds).size) throw invalidOrderItem('部分购物车商品不存在或未勾选')
		return cartItems.map((item) => ({ cartItemId: item.id, quantity: item.quantity, sku: item.sku }))
	}

	const sku = await tx.productSku.findUnique({
		where: { id: input.skuId },
		include: { product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } },
	})
	if (!sku) throw invalidOrderItem('SKU 不存在')
	return [{ quantity: input.quantity, sku }]
}

function validateSingleShop(items) {
	const shopIds = new Set(items.map((item) => item.sku.product.shopId))
	if (shopIds.size !== 1) {
		throw new AppError('当前版本一次只能结算同一店铺的商品', {
			statusCode: 422,
			code: ERROR_CODES.VALIDATION_ERROR,
		})
	}
	return items[0].sku.product.shopId
}

function buildOrderItems(items) {
	return items.map(({ sku, quantity }) => {
		if (!sku.isActive || sku.product.status !== 'ACTIVE') throw invalidOrderItem()
		const goodsAmount = sku.price * quantity
		return {
			skuId: sku.id,
			productName: sku.product.name,
			skuName: sku.name,
			skuCode: sku.skuCode,
			specifications: sku.specifications,
			imageUrl: sku.product.images[0]?.url,
			unitPrice: sku.price,
			quantity,
			goodsAmount,
			discountAmount: 0,
			payableAmount: goodsAmount,
		}
	})
}

async function lockInventory(tx, items, orderId, userId) {
	for (const item of [...items].sort((a, b) => a.sku.id.localeCompare(b.sku.id))) {
		const locked = await tx.inventory.updateMany({
			where: { skuId: item.sku.id, available: { gte: item.quantity } },
			data: {
				available: { decrement: item.quantity },
				locked: { increment: item.quantity },
				version: { increment: 1 },
			},
		})
		if (!locked.count) throw invalidOrderItem(`SKU ${item.sku.skuCode} 库存不足`)
		await tx.inventoryLog.create({
			data: {
				skuId: item.sku.id,
				type: 'ORDER_LOCK',
				availableDiff: -item.quantity,
				lockedDiff: item.quantity,
				referenceType: 'ORDER',
				referenceId: orderId,
				operatorId: userId,
				remark: '创建订单锁定库存',
			},
		})
	}
}

export async function directPreview(userId, input) {
	const address = await prisma.userAddress.findFirst({ where: { id: input.addressId, userId } })
	if (!address) throw new AppError('收货地址不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	const sku = await prisma.productSku.findFirst({
		where: { id: input.skuId, isActive: true, product: { status: 'ACTIVE' } },
		include: { inventory: true, product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } },
	})
	if (!sku || !sku.inventory || sku.inventory.available < input.quantity) throw invalidOrderItem()
	const goodsAmount = sku.price * input.quantity
	const items = [{ quantity: input.quantity, sku }]
	const orderItems = [{ skuId: sku.id, goodsAmount, discountAmount: 0, payableAmount: goodsAmount }]
	const pricing = await calculatePricing(prisma, {
		userId,
		shopId: sku.product.shopId,
		address,
		items,
		orderItems,
		userCouponId: input.userCouponId,
	})
	return {
		items: [
			{
				skuId: sku.id,
				productName: sku.product.name,
				skuName: sku.name,
				quantity: input.quantity,
				unitPrice: sku.price,
				subtotal: goodsAmount,
				imageUrl: sku.product.images[0]?.url ?? null,
			},
		],
		...pricing,
		userCoupon: pricing.userCoupon ? { id: pricing.userCoupon.id, coupon: pricing.userCoupon.coupon } : null,
	}
}

export async function createOrder(userId, input) {
	const existing = await prisma.order.findUnique({
		where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
		include: orderDetailInclude,
	})
	if (existing) return { order: existing, duplicated: true }

	try {
		const order = await prisma.$transaction(
			async (tx) => {
				const address = await tx.userAddress.findFirst({ where: { id: input.addressId, userId } })
				if (!address) throw new AppError('收货地址不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })

				const purchaseItems = await loadPurchaseItems(tx, userId, input)
				const shopId = validateSingleShop(purchaseItems)
				const orderItems = buildOrderItems(purchaseItems)
				const pricing = await calculatePricing(tx, {
					userId,
					shopId,
					address,
					items: purchaseItems,
					orderItems,
					userCouponId: input.userCouponId,
				})
				const expiresAt = new Date(Date.now() + env.ORDER_PAYMENT_EXPIRES_MINUTES * 60 * 1000)
				if (pricing.userCoupon) {
					const used = await tx.userCoupon.updateMany({
						where: { id: pricing.userCoupon.id, userId, status: 'AVAILABLE' },
						data: { status: 'USED', usedAt: new Date() },
					})
					if (!used.count) throw new AppError('优惠券已被使用', { statusCode: 409, code: ERROR_CODES.CONFLICT })
				}

				const created = await tx.order.create({
					data: {
						orderNo: createOrderNo(),
						clientRequestId: input.clientRequestId,
						userId,
						shopId,
						goodsAmount: pricing.goodsAmount,
						discountAmount: pricing.discountAmount,
						shippingAmount: pricing.shippingAmount,
						payableAmount: pricing.payableAmount,
						userCouponId: pricing.userCoupon?.id,
						couponCode: pricing.userCoupon?.coupon.code,
						buyerMessage: input.buyerMessage,
						expiresAt,
						address: {
							create: {
								recipientName: address.recipientName,
								phone: address.phone,
								province: address.province,
								city: address.city,
								district: address.district,
								detail: address.detail,
								postalCode: address.postalCode,
							},
						},
						items: { create: orderItems },
						logs: {
							create: { toStatus: 'PENDING_PAYMENT', action: 'CREATE', operatorId: userId, remark: '用户创建订单' },
						},
					},
				})

				await lockInventory(tx, purchaseItems, created.id, userId)
				if (input.source === 'CART') {
					await tx.cartItem.deleteMany({ where: { userId, id: { in: input.cartItemIds } } })
				}
				return tx.order.findUnique({ where: { id: created.id }, include: orderDetailInclude })
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { order, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const order = await prisma.order.findUnique({
				where: { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } },
				include: orderDetailInclude,
			})
			if (order) return { order, duplicated: true }
		}
		throw error
	}
}

export async function listOrders(userId, query) {
	const where = { userId, ...(query.status ? { status: query.status } : {}) }
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.order.count({ where }),
		prisma.order.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { items: true },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function getOrder(userId, orderId) {
	const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: orderDetailInclude })
	if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return order
}

export async function cancelOrder(userId, orderId, reason = '用户主动取消') {
	return prisma.$transaction(
		async (tx) => {
			const order = await tx.order.findFirst({
				where: { id: orderId, userId },
				include: { items: true },
			})
			if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
			if (order.status === 'CANCELLED') return order
			if (order.status !== 'PENDING_PAYMENT') {
				throw new AppError('当前订单状态不能取消', { statusCode: 409, code: ERROR_CODES.CONFLICT })
			}

			const changed = await tx.order.updateMany({
				where: { id: orderId, status: 'PENDING_PAYMENT' },
				data: { status: 'CANCELLED', cancelledAt: new Date() },
			})
			if (!changed.count)
				throw new AppError('订单状态已变化，请刷新后重试', { statusCode: 409, code: ERROR_CODES.CONFLICT })
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
				if (!released.count) throw new AppError('订单库存锁定数据异常')
				await tx.inventoryLog.create({
					data: {
						skuId: item.skuId,
						type: 'ORDER_RELEASE',
						availableDiff: item.quantity,
						lockedDiff: -item.quantity,
						referenceType: 'ORDER',
						referenceId: order.id,
						operatorId: userId,
						remark: reason,
					},
				})
			}
			await tx.orderLog.create({
				data: {
					orderId,
					fromStatus: 'PENDING_PAYMENT',
					toStatus: 'CANCELLED',
					action: 'CANCEL',
					operatorId: userId,
					remark: reason,
				},
			})
			return tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude })
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	)
}
