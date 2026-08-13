import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const productInclude = {
	images: { take: 1, orderBy: { sortOrder: 'asc' } },
	skus: { where: { isActive: true }, orderBy: { price: 'asc' }, take: 1, select: { price: true } },
}

export async function addFavorite(userId, productId) {
	const product = await prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } })
	if (!product) throw new AppError('商品不存在或已下架', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.favorite.upsert({
		where: { userId_productId: { userId, productId } },
		update: {},
		create: { userId, productId },
	})
}

export function removeFavorite(userId, productId) {
	return prisma.favorite.deleteMany({ where: { userId, productId } })
}

export function listFavorites(userId) {
	return prisma.favorite.findMany({
		where: { userId },
		include: { product: { include: productInclude } },
		orderBy: { createdAt: 'desc' },
	})
}

export async function recordHistory(userId, productId) {
	const product = await prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } })
	if (!product) throw new AppError('商品不存在或已下架', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.browsingHistory.upsert({
		where: { userId_productId: { userId, productId } },
		update: { viewedAt: new Date() },
		create: { userId, productId },
	})
}

export function listHistory(userId) {
	return prisma.browsingHistory.findMany({
		where: { userId },
		include: { product: { include: productInclude } },
		orderBy: { viewedAt: 'desc' },
		take: 100,
	})
}

export function clearHistory(userId) {
	return prisma.browsingHistory.deleteMany({ where: { userId } })
}

export async function buyAgain(userId, orderId) {
	const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } })
	if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	const skus = await prisma.productSku.findMany({
		where: { id: { in: order.items.map((item) => item.skuId) } },
		include: { inventory: true, product: { select: { status: true } } },
	})
	const skuMap = new Map(skus.map((sku) => [sku.id, sku]))
	const added = []
	const skipped = []
	for (const item of order.items) {
		const sku = skuMap.get(item.skuId)
		if (!sku || !sku.isActive || sku.product.status !== 'ACTIVE' || (sku.inventory?.available ?? 0) < 1) {
			skipped.push({ skuId: item.skuId, skuName: item.skuName, reason: '商品已失效或无库存' })
			continue
		}
		const quantity = Math.min(item.quantity, sku.inventory.available, 999)
		const existing = await prisma.cartItem.findUnique({
			where: { userId_skuId: { userId, skuId: item.skuId } },
			select: { quantity: true },
		})
		const finalQuantity = Math.min((existing?.quantity ?? 0) + quantity, sku.inventory.available, 999)
		await prisma.cartItem.upsert({
			where: { userId_skuId: { userId, skuId: item.skuId } },
			update: { quantity: finalQuantity, selected: true },
			create: { userId, skuId: item.skuId, quantity: finalQuantity },
		})
		added.push({ skuId: item.skuId, quantity: finalQuantity })
	}
	return { added, skipped }
}
