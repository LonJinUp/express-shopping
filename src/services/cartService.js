import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { calculatePricing } from './pricingService.js'

const cartInclude = {
	sku: {
		include: {
			inventory: true,
			product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } },
		},
	},
}

function serializeItem(item) {
	const active = item.sku.isActive && item.sku.product.status === 'ACTIVE'
	const available = item.sku.inventory?.available ?? 0
	return {
		id: item.id,
		quantity: item.quantity,
		selected: item.selected,
		valid: active,
		stockEnough: available >= item.quantity,
		sku: {
			id: item.sku.id,
			skuCode: item.sku.skuCode,
			name: item.sku.name,
			specifications: item.sku.specifications,
			price: item.sku.price,
			available,
		},
		product: {
			id: item.sku.product.id,
			name: item.sku.product.name,
			image: item.sku.product.images[0] ?? null,
		},
		subtotal: item.sku.price * item.quantity,
	}
}

export async function listCart(userId) {
	const items = await prisma.cartItem.findMany({
		where: { userId },
		include: cartInclude,
		orderBy: { createdAt: 'desc' },
	})
	return items.map(serializeItem)
}

export async function addItem(userId, input) {
	const sku = await prisma.productSku.findFirst({
		where: { id: input.skuId, isActive: true, product: { status: 'ACTIVE' } },
		include: { inventory: true },
	})
	if (!sku) throw new AppError('SKU 不存在或商品已下架', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	if (!sku.inventory || sku.inventory.available < input.quantity) {
		throw new AppError('商品库存不足', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const existing = await prisma.cartItem.findUnique({ where: { userId_skuId: { userId, skuId: input.skuId } } })
	const quantity = (existing?.quantity ?? 0) + input.quantity
	if (quantity > sku.inventory.available || quantity > 999) {
		throw new AppError('购物车数量超过可用库存', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	return prisma.cartItem.upsert({
		where: { userId_skuId: { userId, skuId: input.skuId } },
		update: { quantity, selected: true },
		create: { userId, skuId: input.skuId, quantity },
		include: cartInclude,
	})
}

export async function updateItem(userId, itemId, input) {
	const item = await prisma.cartItem.findFirst({
		where: { id: itemId, userId },
		include: { sku: { include: { inventory: true } } },
	})
	if (!item) throw new AppError('购物车商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	if (input.quantity && input.quantity > (item.sku.inventory?.available ?? 0)) {
		throw new AppError('商品库存不足', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	return prisma.cartItem.update({ where: { id: itemId }, data: input, include: cartInclude })
}

export async function deleteItem(userId, itemId) {
	const result = await prisma.cartItem.deleteMany({ where: { id: itemId, userId } })
	if (!result.count) throw new AppError('购物车商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
}

export async function selectItems(userId, itemIds, selected) {
	await prisma.cartItem.updateMany({
		where: { userId, ...(itemIds.length ? { id: { in: itemIds } } : {}) },
		data: { selected },
	})
	return listCart(userId)
}

export async function checkoutPreview(userId, input) {
	const address = await prisma.userAddress.findFirst({ where: { id: input.addressId, userId } })
	if (!address) throw new AppError('收货地址不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	const items = await prisma.cartItem.findMany({
		where: { userId, selected: true, ...(input.itemIds?.length ? { id: { in: input.itemIds } } : {}) },
		include: cartInclude,
	})
	if (!items.length) throw new AppError('请选择要结算的商品', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	const serialized = items.map(serializeItem)
	if (serialized.some((item) => !item.valid || !item.stockEnough)) {
		throw new AppError('结算商品已失效或库存不足', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const shopIds = new Set(items.map((item) => item.sku.product.shopId))
	if (shopIds.size !== 1)
		throw new AppError('当前版本一次只能结算同一店铺的商品', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	const orderItems = items.map((item) => ({
		skuId: item.skuId,
		goodsAmount: item.sku.price * item.quantity,
		discountAmount: 0,
		payableAmount: item.sku.price * item.quantity,
	}))
	const pricing = await calculatePricing(prisma, {
		userId,
		shopId: items[0].sku.product.shopId,
		address,
		items: items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
		orderItems,
		userCouponId: input.userCouponId,
	})
	return {
		items: serialized.map((item, index) => ({
			...item,
			discountAmount: orderItems[index].discountAmount,
			payableAmount: orderItems[index].payableAmount,
		})),
		...pricing,
		userCoupon: pricing.userCoupon ? { id: pricing.userCoupon.id, coupon: pricing.userCoupon.coupon } : null,
	}
}
