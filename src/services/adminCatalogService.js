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

async function getTargetShop(tx, shopId) {
	const shop = shopId
		? await tx.shop.findFirst({ where: { id: shopId, status: 'ACTIVE' }, select: { id: true } })
		: await tx.shop.findUnique({ where: { code: 'DEFAULT' }, select: { id: true } })
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

export async function listProducts(query, shopId) {
	const where = {
		...(shopId ? { shopId } : {}),
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

export async function getProduct(productId, shopId) {
	const product = await prisma.product.findFirst({
		where: { id: productId, ...(shopId ? { shopId } : {}) },
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

export function createProduct(input, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		await assertCategoryAndBrand(tx, input.categoryId, input.brandId)
		const shop = await getTargetShop(tx, shopId)
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

export function updateProduct(productId, input, shopId) {
	return prisma.$transaction(async (tx) => {
		const product = await tx.product.findFirst({
			where: { id: productId, ...(shopId ? { shopId } : {}) },
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

export async function changeProductStatus(productId, status, shopId) {
	const product = await prisma.product.findFirst({
		where: { id: productId, ...(shopId ? { shopId } : {}) },
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

export async function deleteProduct(productId, shopId) {
	const result = await prisma.product.updateMany({
		where: { id: productId, status: { not: 'DELETED' }, ...(shopId ? { shopId } : {}) },
		data: { status: 'DELETED' },
	})
	if (!result.count) throw new AppError('商品不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
}

export function createSku(productId, input, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const product = await tx.product.findFirst({
			where: { id: productId, status: { not: 'DELETED' }, ...(shopId ? { shopId } : {}) },
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

export async function updateSku(skuId, input, shopId) {
	const exists = await prisma.productSku.findFirst({
		where: { id: skuId, ...(shopId ? { product: { shopId } } : {}) },
		select: { id: true },
	})
	if (!exists) throw new AppError('SKU 不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.productSku.update({ where: { id: skuId }, data: input, include: { inventory: true } })
}

export function adjustInventory(skuId, difference, remark, operatorId, shopId) {
	return prisma.$transaction(async (tx) => {
		const inventory = await tx.inventory.findFirst({
			where: { skuId, ...(shopId ? { sku: { product: { shopId } } } : {}) },
		})
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
