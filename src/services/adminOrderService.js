import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const detailInclude = {
	address: true,
	items: true,
	logs: { orderBy: { createdAt: 'asc' } },
	notes: { orderBy: { createdAt: 'asc' } },
	payments: true,
	shipment: true,
}

export async function listOrders(query, shopId) {
	const where = {
		...(shopId ? { shopId } : {}),
		...(query.status ? { status: query.status } : {}),
		...(query.orderNo ? { orderNo: query.orderNo } : {}),
	}
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.order.count({ where }),
		prisma.order.findMany({
			where,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { items: true, user: { select: { id: true, nickname: true, email: true, phone: true } } },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function getOrder(orderId, shopId) {
	const order = await prisma.order.findFirst({
		where: { id: orderId, ...(shopId ? { shopId } : {}) },
		include: detailInclude,
	})
	if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return order
}

export async function addNote(orderId, operatorId, content, shopId) {
	const order = await prisma.order.findFirst({
		where: { id: orderId, ...(shopId ? { shopId } : {}) },
		select: { id: true },
	})
	if (!order) throw new AppError('订单不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return prisma.orderNote.create({ data: { orderId, operatorId, content } })
}
