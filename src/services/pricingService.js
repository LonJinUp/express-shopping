import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

function eligibleItems(items, coupon) {
	if (!coupon) return []
	if (coupon.scope === 'ALL') return items
	const productIds = new Set(coupon.products.map((item) => item.productId))
	const categoryIds = new Set(coupon.categories.map((item) => item.categoryId))
	return items.filter(({ sku }) =>
		coupon.scope === 'PRODUCT' ? productIds.has(sku.productId) : categoryIds.has(sku.product.categoryId)
	)
}

export function distributeDiscount(orderItems, eligibleSkuIds, discountAmount) {
	const eligible = orderItems.filter((item) => eligibleSkuIds.has(item.skuId))
	const eligibleAmount = eligible.reduce((total, item) => total + item.goodsAmount, 0)
	let allocated = 0
	for (let index = 0; index < eligible.length; index += 1) {
		const item = eligible[index]
		const amount =
			index === eligible.length - 1
				? discountAmount - allocated
				: Math.floor((discountAmount * item.goodsAmount) / eligibleAmount)
		item.discountAmount = amount
		item.payableAmount = item.goodsAmount - amount
		allocated += amount
	}
}

export async function calculatePricing(tx, { userId, shopId, address, items, orderItems, userCouponId }) {
	const goodsAmount = orderItems.reduce((total, item) => total + item.goodsAmount, 0)
	const template = await tx.shippingTemplate.findFirst({
		where: { shopId, isDefault: true, isActive: true },
		include: { regionRules: true },
	})
	let shippingAmount = template?.baseFee ?? 0
	if (template) {
		const region = template.regionRules.find((rule) => rule.province === address.province)
		if (region) shippingAmount = region.fee
		if (template.freeThreshold !== null && goodsAmount >= template.freeThreshold) shippingAmount = 0
	}

	let userCoupon = null
	let discountAmount = 0
	if (userCouponId) {
		userCoupon = await tx.userCoupon.findFirst({
			where: { id: userCouponId, userId, status: 'AVAILABLE' },
			include: { coupon: { include: { products: true, categories: true } } },
		})
		const now = new Date()
		if (
			!userCoupon ||
			!userCoupon.coupon.isActive ||
			userCoupon.coupon.startsAt > now ||
			userCoupon.coupon.endsAt < now
		) {
			throw new AppError('优惠券不可用或已过期', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		}
		if (userCoupon.coupon.shopId !== shopId) {
			throw new AppError('优惠券不适用于当前店铺', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		}
		const eligible = eligibleItems(items, userCoupon.coupon)
		const eligibleAmount = eligible.reduce((total, item) => total + item.sku.price * item.quantity, 0)
		if (!eligible.length || eligibleAmount < userCoupon.coupon.thresholdAmount) {
			throw new AppError('未达到优惠券使用条件', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		}
		discountAmount = Math.min(userCoupon.coupon.discountAmount, eligibleAmount)
		distributeDiscount(orderItems, new Set(eligible.map((item) => item.sku.id)), discountAmount)
	}

	return {
		goodsAmount,
		discountAmount,
		shippingAmount,
		payableAmount: goodsAmount - discountAmount + shippingAmount,
		userCoupon,
	}
}
