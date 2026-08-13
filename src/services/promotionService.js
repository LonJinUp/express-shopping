import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

async function defaultShopId(tx) {
	const shop = await tx.shop.findUnique({ where: { code: 'DEFAULT' }, select: { id: true } })
	if (!shop) throw new AppError('默认店铺尚未初始化')
	return shop.id
}

export async function listAvailableCoupons() {
	const now = new Date()
	const coupons = await prisma.coupon.findMany({
		where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
		orderBy: { endsAt: 'asc' },
	})
	return coupons.filter((coupon) => coupon.claimedQuantity < coupon.totalQuantity)
}

export function listUserCoupons(userId, status) {
	const now = new Date()
	const where = {
		userId,
		...(status === 'EXPIRED'
			? { status: 'AVAILABLE', coupon: { endsAt: { lt: now } } }
			: status === 'AVAILABLE'
				? { status: 'AVAILABLE', coupon: { endsAt: { gte: now }, startsAt: { lte: now }, isActive: true } }
				: status
					? { status }
					: {}),
	}
	return prisma.userCoupon
		.findMany({
			where,
			include: { coupon: true },
			orderBy: { createdAt: 'desc' },
		})
		.then((items) =>
			items.map((item) =>
				item.status === 'AVAILABLE' && item.coupon.endsAt < now ? { ...item, status: 'EXPIRED' } : item
			)
		)
}

export function claimCoupon(userId, couponId) {
	return prisma.$transaction(
		async (tx) => {
			const coupon = await tx.coupon.findUnique({ where: { id: couponId } })
			const now = new Date()
			if (!coupon || !coupon.isActive || coupon.startsAt > now || coupon.endsAt < now) {
				throw new AppError('优惠券不存在或当前不可领取', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
			}
			const claimed = await tx.userCoupon.count({ where: { userId, couponId } })
			if (claimed >= coupon.perUserLimit) {
				throw new AppError('已达到该优惠券领取上限', { statusCode: 409, code: ERROR_CODES.CONFLICT })
			}
			const reserved = await tx.coupon.updateMany({
				where: { id: couponId, claimedQuantity: { lt: coupon.totalQuantity } },
				data: { claimedQuantity: { increment: 1 } },
			})
			if (!reserved.count) throw new AppError('优惠券已领完', { statusCode: 409, code: ERROR_CODES.CONFLICT })
			return tx.userCoupon.create({ data: { userId, couponId }, include: { coupon: true } })
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	)
}

export function createCoupon(input) {
	return prisma.$transaction(async (tx) => {
		const shopId = await defaultShopId(tx)
		const { productIds, categoryIds, ...data } = input
		return tx.coupon.create({
			data: {
				...data,
				shopId,
				products: { create: productIds.map((productId) => ({ productId })) },
				categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
			},
			include: { products: true, categories: true },
		})
	})
}

export function createShippingTemplate(input) {
	return prisma.$transaction(async (tx) => {
		const shopId = await defaultShopId(tx)
		if (input.isDefault) await tx.shippingTemplate.updateMany({ where: { shopId }, data: { isDefault: false } })
		const { regionRules, ...data } = input
		return tx.shippingTemplate.create({
			data: { ...data, shopId, regionRules: { create: regionRules } },
			include: { regionRules: true },
		})
	})
}
