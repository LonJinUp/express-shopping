import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export async function createReview(userId, input) {
	const orderItem = await prisma.orderItem.findFirst({
		where: { id: input.orderItemId, order: { userId, status: 'COMPLETED' } },
		select: { id: true },
	})
	if (!orderItem) {
		throw new AppError('只能评价已完成订单中的商品', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const existing = await prisma.review.findUnique({ where: { orderItemId: input.orderItemId }, select: { id: true } })
	if (existing) throw new AppError('该订单商品已评价', { statusCode: 409, code: ERROR_CODES.CONFLICT })

	const { images, ...data } = input
	return prisma.review.create({
		data: {
			...data,
			userId,
			images: { create: images.map((url, sortOrder) => ({ url, sortOrder })) },
		},
		include: { images: { orderBy: { sortOrder: 'asc' } } },
	})
}

export async function listProductReviews(productId, query) {
	const where = { status: 'APPROVED', orderItem: { sku: { productId } } }
	const skip = (query.page - 1) * query.pageSize
	const [total, items, aggregate] = await prisma.$transaction([
		prisma.review.count({ where }),
		prisma.review.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: {
				images: { orderBy: { sortOrder: 'asc' } },
				user: { select: { nickname: true, avatarUrl: true } },
				orderItem: { select: { skuName: true, specifications: true } },
			},
		}),
		prisma.review.aggregate({ where, _avg: { rating: true } }),
	])
	return {
		items: items.map((item) => ({
			...item,
			user: item.isAnonymous ? { nickname: '匿名用户', avatarUrl: null } : item.user,
		})),
		averageRating: aggregate._avg.rating ?? 0,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function listReviews(query) {
	const where = query.status ? { status: query.status } : {}
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.review.count({ where }),
		prisma.review.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { images: true, user: { select: { id: true, nickname: true } }, orderItem: true },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function moderateReview(reviewId, status) {
	const result = await prisma.review.updateMany({
		where: { id: reviewId },
		data: { status, reviewedAt: new Date() },
	})
	if (!result.count) throw new AppError('评价不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.review.findUnique({ where: { id: reviewId }, include: { images: true } })
}
