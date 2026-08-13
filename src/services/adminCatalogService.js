import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

async function assertCategoryAndBrand(tx, categoryId, brandId) {
	const [category, brand] = await Promise.all([
		tx.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
		brandId ? tx.brand.findUnique({ where: { id: brandId }, select: { id: true } }) : Promise.resolve(true),
	])
	if (!category) throw new AppError('商品分类不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	if (!brand) throw new AppError('商品品牌不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
}

async function getDefaultShop(tx) {
	const shop = await tx.shop.findUnique({ where: { code: 'DEFAULT' }, select: { id: true } })
	if (!shop) throw new AppError('默认店铺尚未初始化')
	return shop
}

export function createCategory(input) {
	return prisma.category.create({ data: input })
}

export async function updateCategory(categoryId, input) {
	if (input.parentId === categoryId) {
		throw new AppError('分类不能将自己设为父级', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const exists = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
	if (!exists) throw new AppError('分类不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.category.update({ where: { id: categoryId }, data: input })
}

export function createBrand(input) {
	return prisma.brand.create({ data: input })
}

export async function updateBrand(brandId, input) {
	const exists = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } })
	if (!exists) throw new AppError('品牌不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.brand.update({ where: { id: brandId }, data: input })
}

export async function listProducts(query) {
	const where = {
		...(query.keyword ? { name: { contains: query.keyword } } : {}),
		...(query.status ? { status: query.status } : { status: { not: 'DELETED' } }),
	}
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.product.count({ where }),
		prisma.product.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: {
				category: { select: { id: true, name: true } },
				brand: { select: { id: true, name: true } },
				_count: { select: { skus: true } },
			},
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function getProduct(productId) {
	const product = await prisma.product.findUnique({
		where: { id: productId },
		include: {
			category: true,
			brand: true,
			images: { orderBy: { sortOrder: 'asc' } },
			skus: { include: { inventory: true }, orderBy: { createdAt: 'asc' } },
		},
	})
	if (!product) throw new AppError('商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return product
}

export function createProduct(input, operatorId) {
	return prisma.$transaction(async (tx) => {
		await assertCategoryAndBrand(tx, input.categoryId, input.brandId)
		const shop = await getDefaultShop(tx)
		const { images, skus, ...productData } = input
		return tx.product.create({
			data: {
				...productData,
				shopId: shop.id,
				images: { create: images },
				skus: {
					create: skus.map(({ stock, ...sku }) => ({
						...sku,
						inventory: { create: { available: stock } },
						...(stock > 0
							? {
									inventoryLogs: {
										create: {
											type: 'INITIAL',
											availableDiff: stock,
											lockedDiff: 0,
											operatorId,
											remark: '商品创建时初始化库存',
										},
									},
								}
							: {}),
					})),
				},
			},
			include: { images: true, skus: { include: { inventory: true } } },
		})
	})
}

export function updateProduct(productId, input) {
	return prisma.$transaction(async (tx) => {
		const product = await tx.product.findUnique({
			where: { id: productId },
			select: { id: true, categoryId: true, brandId: true },
		})
		if (!product) throw new AppError('商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		if ('categoryId' in input || 'brandId' in input) {
			await assertCategoryAndBrand(
				tx,
				input.categoryId ?? product.categoryId,
				'brandId' in input ? input.brandId : product.brandId
			)
		}
		const { images, ...productData } = input
		if (images) await tx.productImage.deleteMany({ where: { productId } })
		return tx.product.update({
			where: { id: productId },
			data: { ...productData, ...(images ? { images: { create: images } } : {}) },
			include: { images: { orderBy: { sortOrder: 'asc' } } },
		})
	})
}

export async function changeProductStatus(productId, status) {
	const product = await prisma.product.findUnique({
		where: { id: productId },
		include: { skus: { where: { isActive: true }, include: { inventory: true } } },
	})
	if (!product || product.status === 'DELETED') {
		throw new AppError('商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	}
	if (status === 'ACTIVE' && !product.skus.some((sku) => sku.inventory)) {
		throw new AppError('商品至少需要一个有效 SKU 才能上架', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	return prisma.product.update({ where: { id: productId }, data: { status } })
}

export async function deleteProduct(productId) {
	const result = await prisma.product.updateMany({
		where: { id: productId, status: { not: 'DELETED' } },
		data: { status: 'DELETED' },
	})
	if (!result.count) throw new AppError('商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
}

export function createSku(productId, input, operatorId) {
	return prisma.$transaction(async (tx) => {
		const product = await tx.product.findFirst({
			where: { id: productId, status: { not: 'DELETED' } },
			select: { id: true },
		})
		if (!product) throw new AppError('商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		const { stock, ...skuData } = input
		return tx.productSku.create({
			data: {
				...skuData,
				productId,
				inventory: { create: { available: stock } },
				...(stock > 0
					? {
							inventoryLogs: {
								create: {
									type: 'INITIAL',
									availableDiff: stock,
									lockedDiff: 0,
									operatorId,
									remark: '新增 SKU 初始化库存',
								},
							},
						}
					: {}),
			},
			include: { inventory: true },
		})
	})
}

export async function updateSku(skuId, input) {
	const exists = await prisma.productSku.findUnique({ where: { id: skuId }, select: { id: true } })
	if (!exists) throw new AppError('SKU 不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.productSku.update({ where: { id: skuId }, data: input, include: { inventory: true } })
}

export function adjustInventory(skuId, difference, remark, operatorId) {
	return prisma.$transaction(async (tx) => {
		const inventory = await tx.inventory.findUnique({ where: { skuId } })
		if (!inventory) throw new AppError('SKU 库存不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
		if (inventory.available + difference < 0) {
			throw new AppError('可用库存不足，不能调整为负数', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		}
		const updated = await tx.inventory.update({
			where: { skuId },
			data: { available: { increment: difference }, version: { increment: 1 } },
		})
		await tx.inventoryLog.create({
			data: { skuId, type: 'MANUAL_ADJUSTMENT', availableDiff: difference, lockedDiff: 0, operatorId, remark },
		})
		return updated
	})
}
