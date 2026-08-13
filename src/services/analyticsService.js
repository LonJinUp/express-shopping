import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const paidStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'AFTER_SALE', 'REFUNDING']

function dateRange(query) {
	const endDate = query.endDate ?? new Date()
	const startDate = query.startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
	if (endDate <= startDate)
		throw new AppError('结束时间必须晚于开始时间', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	if (endDate.getTime() - startDate.getTime() > 90 * 24 * 60 * 60 * 1000) {
		throw new AppError('查询或导出时间跨度不能超过 90 天', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	return { startDate, endDate }
}

export async function dashboard(query) {
	const { startDate, endDate } = dateRange(query)
	const createdAt = { gte: startDate, lte: endDate }
	const [orderCount, paidAggregate, paidOrderCount, hotProducts] = await prisma.$transaction([
		prisma.order.count({ where: { createdAt } }),
		prisma.order.aggregate({
			where: { createdAt, status: { in: paidStatuses } },
			_sum: { paidAmount: true, refundedAmount: true },
		}),
		prisma.order.count({ where: { createdAt, status: { in: paidStatuses } } }),
		prisma.orderItem.groupBy({
			by: ['skuId', 'productName'],
			where: { order: { createdAt, status: { in: paidStatuses } } },
			_sum: { quantity: true, payableAmount: true },
			orderBy: { _sum: { quantity: 'desc' } },
			take: query.limit,
		}),
	])
	const salesAmount = (paidAggregate._sum.paidAmount ?? 0) - (paidAggregate._sum.refundedAmount ?? 0)
	return {
		period: { startDate, endDate },
		orderCount,
		paidOrderCount,
		salesAmount,
		conversionRate: orderCount ? Number((paidOrderCount / orderCount).toFixed(4)) : 0,
		averageOrderValue: paidOrderCount ? Math.floor(salesAmount / paidOrderCount) : 0,
		hotProducts,
	}
}

export function csvCell(value) {
	let text = value === null || value === undefined ? '' : String(value)
	if (/^[=+\-@]/.test(text)) text = `'${text}`
	return `"${text.replaceAll('"', '""')}"`
}

export async function exportOrders(query) {
	const { startDate, endDate } = dateRange(query)
	const orders = await prisma.order.findMany({
		where: { createdAt: { gte: startDate, lte: endDate }, ...(query.status ? { status: query.status } : {}) },
		include: { user: { select: { nickname: true, email: true, phone: true } }, address: true },
		orderBy: { createdAt: 'desc' },
		take: 10_001,
	})
	if (orders.length > 10_000) {
		throw new AppError('导出数据超过 10000 条，请缩小时间范围', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const headers = [
		'订单号',
		'状态',
		'用户',
		'联系方式',
		'商品金额(分)',
		'优惠(分)',
		'运费(分)',
		'实付(分)',
		'收件人',
		'省市区',
		'创建时间',
	]
	const rows = orders.map((order) => [
		order.orderNo,
		order.status,
		order.user.nickname,
		order.user.phone ?? order.user.email,
		order.goodsAmount,
		order.discountAmount,
		order.shippingAmount,
		order.paidAmount,
		order.address?.recipientName,
		order.address ? `${order.address.province}${order.address.city}${order.address.district}` : '',
		order.createdAt.toISOString(),
	])
	return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}
