import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export function listCategories() {
	return prisma.category.findMany({
		where: { isActive: true },
		orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
		select: { id: true, parentId: true, name: true, slug: true, sortOrder: true },
	})
}

export function listBrands() {
	return prisma.brand.findMany({
		where: { isActive: true },
		orderBy: { name: 'asc' },
		select: { id: true, name: true, logoUrl: true },
	})
}

export async function listProducts(query) {
	const where = {
		status: 'ACTIVE',
		...(query.keyword ? { name: { contains: query.keyword } } : {}),
		...(query.categoryId ? { categoryId: query.categoryId } : {}),
		...(query.brandId ? { brandId: query.brandId } : {}),
		...(query.minPrice !== undefined || query.maxPrice !== undefined
			? {
					skus: {
						some: {
							isActive: true,
							price: {
								...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
								...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
							},
						},
					},
				}
			: {}),
	}
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.product.count({ where }),
		prisma.product.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
			select: {
				id: true,
				name: true,
				subtitle: true,
				slug: true,
				images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true, alt: true } },
				skus: {
					where: { isActive: true },
					orderBy: { price: 'asc' },
					take: 1,
					select: { price: true, marketPrice: true },
				},
			},
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function getProduct(productId) {
	const product = await prisma.product.findFirst({
		where: { id: productId, status: 'ACTIVE' },
		include: {
			category: { select: { id: true, name: true, slug: true } },
			brand: { select: { id: true, name: true, logoUrl: true } },
			images: { orderBy: { sortOrder: 'asc' } },
			skus: { where: { isActive: true }, include: { inventory: true }, orderBy: { price: 'asc' } },
		},
	})
	if (!product) throw new AppError('商品不存在或已下架', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return product
}
