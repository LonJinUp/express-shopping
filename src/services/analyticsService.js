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

export async function dashboard(query, shopId) {
	const { startDate, endDate } = dateRange(query)
	const createdAt = { gte: startDate, lte: endDate }
	const orderWhere = { createdAt, ...(shopId ? { shopId } : {}) }
	const [orderCount, paidAggregate, paidOrderCount, hotProducts] = await prisma.$transaction([
		prisma.order.count({ where: orderWhere }),
		prisma.order.aggregate({
			where: { ...orderWhere, status: { in: paidStatuses } },
			_sum: { paidAmount: true, refundedAmount: true },
		}),
		prisma.order.count({ where: { ...orderWhere, status: { in: paidStatuses } } }),
		prisma.orderItem.groupBy({
			by: ['skuId', 'productName'],
			where: { order: { ...orderWhere, status: { in: paidStatuses } } },
			_sum: { quantity: true, payableAmount: true },
			orderBy: { _sum: { quantity: 'desc' } },
			take: query.limit,
		}),
	])
	const salesAmount = (paidAggregate._sum.paidAmount ?? 0) - (paidAggregate._sum.refundedAmount ?? 0)
	const result = {
		period: { startDate, endDate },
		orderCount,
		paidOrderCount,
		salesAmount,
		conversionRate: orderCount ? Number((paidOrderCount / orderCount).toFixed(4)) : 0,
		averageOrderValue: paidOrderCount ? Math.floor(salesAmount / paidOrderCount) : 0,
		hotProducts,
	}
	if (!shopId) return result

	const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { merchantId: true } })
	if (!shop) throw new AppError('店铺不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	const ledgerWhere = { shopId, createdAt, type: { in: ['PAYMENT', 'REFUND'] } }
	const [paymentLedger, refundLedger, account, settlementAggregate, settlementCount, withdrawalGroups] =
		await prisma.$transaction([
			prisma.merchantLedgerEntry.aggregate({
				where: { ...ledgerWhere, type: 'PAYMENT' },
				_sum: { grossAmount: true, commissionAmount: true, netAmount: true },
			}),
			prisma.merchantLedgerEntry.aggregate({
				where: { ...ledgerWhere, type: 'REFUND' },
				_sum: { grossAmount: true, commissionAmount: true, netAmount: true },
			}),
			prisma.merchantAccount.findUnique({ where: { merchantId: shop.merchantId } }),
			prisma.merchantSettlement.aggregate({
				where: { merchantId: shop.merchantId, createdAt, orders: { some: { shopId } } },
				_sum: { grossAmount: true, refundAmount: true, commissionAmount: true, netAmount: true },
			}),
			prisma.merchantSettlement.count({
				where: { merchantId: shop.merchantId, createdAt, orders: { some: { shopId } } },
			}),
			prisma.merchantWithdrawal.groupBy({
				by: ['status'],
				where: { merchantId: shop.merchantId },
				_count: { _all: true },
				_sum: { amount: true },
			}),
		])
	const paymentGross = paymentLedger._sum.grossAmount ?? 0
	const refundAmount = -(refundLedger._sum.grossAmount ?? 0)
	return {
		...result,
		finance: {
			paymentGross,
			refundAmount,
			commissionAmount: (paymentLedger._sum.commissionAmount ?? 0) + (refundLedger._sum.commissionAmount ?? 0),
			merchantNet: (paymentLedger._sum.netAmount ?? 0) + (refundLedger._sum.netAmount ?? 0),
			refundRate: paymentGross ? Number((refundAmount / paymentGross).toFixed(4)) : 0,
			merchantAccount: account ?? {
				merchantId: shop.merchantId,
				pendingAmount: 0,
				availableAmount: 0,
				frozenAmount: 0,
				withdrawnAmount: 0,
			},
			settlements: {
				count: settlementCount,
				grossAmount: settlementAggregate._sum.grossAmount ?? 0,
				refundAmount: settlementAggregate._sum.refundAmount ?? 0,
				commissionAmount: settlementAggregate._sum.commissionAmount ?? 0,
				netAmount: settlementAggregate._sum.netAmount ?? 0,
			},
			withdrawals: Object.fromEntries(
				withdrawalGroups.map((item) => [item.status, { count: item._count._all, amount: item._sum.amount ?? 0 }])
			),
		},
	}
}

export async function platformOverview(query) {
	const { startDate, endDate } = dateRange(query)
	const createdAt = { gte: startDate, lte: endDate }
	const paidAt = { gte: startDate, lte: endDate }
	const refundedAt = { gte: startDate, lte: endDate }
	const [
		merchantCount,
		activeMerchantCount,
		newMerchantCount,
		shopCount,
		activeShopCount,
		platformOrderCount,
		childOrderCount,
		paymentAggregate,
		paymentCount,
		refundAggregate,
		refundCount,
		ledgerAggregate,
		accountAggregate,
		pendingApplications,
		pendingArbitrations,
		pendingWithdrawals,
		activeShopGroups,
		merchantGroups,
	] = await prisma.$transaction([
		prisma.merchant.count(),
		prisma.merchant.count({ where: { status: 'ACTIVE' } }),
		prisma.merchant.count({ where: { createdAt } }),
		prisma.shop.count(),
		prisma.shop.count({ where: { status: 'ACTIVE' } }),
		prisma.platformOrder.count({ where: { createdAt } }),
		prisma.order.count({ where: { createdAt } }),
		prisma.payment.aggregate({
			where: { status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, paidAt },
			_sum: { amount: true },
		}),
		prisma.payment.count({
			where: { status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, paidAt },
		}),
		prisma.refund.aggregate({ where: { status: 'SUCCESS', refundedAt }, _sum: { amount: true } }),
		prisma.refund.count({ where: { status: 'SUCCESS', refundedAt } }),
		prisma.merchantLedgerEntry.aggregate({
			where: { type: { in: ['PAYMENT', 'REFUND'] }, createdAt },
			_sum: { commissionAmount: true, netAmount: true },
		}),
		prisma.merchantAccount.aggregate({
			_sum: { pendingAmount: true, availableAmount: true, frozenAmount: true, withdrawnAmount: true },
		}),
		prisma.merchantApplication.count({ where: { status: 'PENDING' } }),
		prisma.afterSaleArbitration.count({ where: { status: 'PENDING' } }),
		prisma.merchantWithdrawal.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
		prisma.order.groupBy({
			by: ['shopId'],
			where: { paidAt, status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] } },
		}),
		prisma.merchantLedgerEntry.groupBy({
			by: ['merchantId'],
			where: { type: { in: ['PAYMENT', 'REFUND'] }, createdAt },
			_sum: { grossAmount: true, commissionAmount: true, netAmount: true },
			orderBy: { _sum: { netAmount: 'desc' } },
			take: query.limit,
		}),
	])
	const merchantIds = merchantGroups.map((item) => item.merchantId)
	const merchants = await prisma.merchant.findMany({
		where: { id: { in: merchantIds } },
		select: { id: true, name: true, code: true, status: true },
	})
	const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]))
	const paymentAmount = paymentAggregate._sum.amount ?? 0
	const refundAmount = refundAggregate._sum.amount ?? 0
	return {
		period: { startDate, endDate },
		merchants: {
			total: merchantCount,
			active: activeMerchantCount,
			new: newMerchantCount,
			shops: shopCount,
			activeShops: activeShopCount,
			activeSellingShops: activeShopGroups.length,
		},
		transactions: {
			platformOrderCount,
			childOrderCount,
			paymentCount,
			paymentAmount,
			refundCount,
			refundAmount,
			netPaymentAmount: paymentAmount - refundAmount,
			commissionAmount: ledgerAggregate._sum.commissionAmount ?? 0,
			merchantNetAmount: ledgerAggregate._sum.netAmount ?? 0,
		},
		merchantLiabilities: {
			pendingAmount: accountAggregate._sum.pendingAmount ?? 0,
			availableAmount: accountAggregate._sum.availableAmount ?? 0,
			frozenAmount: accountAggregate._sum.frozenAmount ?? 0,
			withdrawnAmount: accountAggregate._sum.withdrawnAmount ?? 0,
		},
		pendingTasks: {
			merchantApplications: pendingApplications,
			arbitrations: pendingArbitrations,
			withdrawals: pendingWithdrawals,
		},
		merchantRanking: merchantGroups.map((item) => ({
			merchant: merchantById.get(item.merchantId),
			grossAmount: item._sum.grossAmount ?? 0,
			commissionAmount: item._sum.commissionAmount ?? 0,
			netAmount: item._sum.netAmount ?? 0,
		})),
	}
}

export function csvCell(value) {
	let text = value === null || value === undefined ? '' : String(value)
	if (/^[=+\-@]/.test(text)) text = `'${text}`
	return `"${text.replaceAll('"', '""')}"`
}

export async function exportOrders(query, shopId) {
	const { startDate, endDate } = dateRange(query)
	const orders = await prisma.order.findMany({
		where: {
			createdAt: { gte: startDate, lte: endDate },
			...(shopId ? { shopId } : {}),
			...(query.status ? { status: query.status } : {}),
		},
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
