import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { createSettlementNo, createWithdrawalNo } from '../utils/transactionNo.js'

function conflict(message) {
	return new AppError(message, { statusCode: 409, code: ERROR_CODES.CONFLICT })
}

async function ensureAccount(tx, merchantId) {
	return tx.merchantAccount.upsert({
		where: { merchantId },
		update: {},
		create: { merchantId },
	})
}

export async function recordPaymentRevenue(tx, paymentId) {
	const existing = await tx.merchantLedgerEntry.findUnique({
		where: { type_referenceId: { type: 'PAYMENT', referenceId: paymentId } },
	})
	if (existing) return existing
	const payment = await tx.payment.findUnique({
		where: { id: paymentId },
		include: { order: { include: { shop: true } } },
	})
	if (!payment || !['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)) {
		throw new AppError('支付收入记账条件不满足')
	}
	const { order } = payment
	const commissionAmount = Math.floor((payment.amount * order.shop.commissionRateBps) / 10_000)
	const netAmount = payment.amount - commissionAmount
	await ensureAccount(tx, order.shop.merchantId)
	await tx.merchantAccount.update({
		where: { merchantId: order.shop.merchantId },
		data: { pendingAmount: { increment: netAmount } },
	})
	return tx.merchantLedgerEntry.create({
		data: {
			merchantId: order.shop.merchantId,
			shopId: order.shopId,
			orderId: order.id,
			type: 'PAYMENT',
			referenceId: payment.id,
			grossAmount: payment.amount,
			commissionRateBps: order.shop.commissionRateBps,
			commissionAmount,
			netAmount,
			pendingAmountDiff: netAmount,
			remark: `订单 ${order.orderNo} 支付入账`,
		},
	})
}

export async function recordRefundReversal(tx, refundId) {
	const existing = await tx.merchantLedgerEntry.findUnique({
		where: { type_referenceId: { type: 'REFUND', referenceId: refundId } },
	})
	if (existing) return existing
	const refund = await tx.refund.findUnique({
		where: { id: refundId },
		include: { payment: true, afterSale: { include: { order: { include: { shop: true } } } } },
	})
	if (!refund || refund.status !== 'SUCCESS') throw new AppError('退款冲销记账条件不满足')
	let paymentEntry = await tx.merchantLedgerEntry.findUnique({
		where: { type_referenceId: { type: 'PAYMENT', referenceId: refund.paymentId } },
	})
	if (!paymentEntry) paymentEntry = await recordPaymentRevenue(tx, refund.paymentId)
	const order = refund.afterSale.order
	const commissionAmount = -Math.floor((refund.amount * paymentEntry.commissionRateBps) / 10_000)
	const netAmount = -(refund.amount + commissionAmount)
	const settled = await tx.merchantSettlementOrder.findUnique({
		where: { orderId: order.id },
		select: { orderId: true },
	})
	const accountField = settled ? 'availableAmount' : 'pendingAmount'
	await tx.merchantAccount.update({
		where: { merchantId: order.shop.merchantId },
		data: { [accountField]: { increment: netAmount } },
	})
	return tx.merchantLedgerEntry.create({
		data: {
			merchantId: order.shop.merchantId,
			shopId: order.shopId,
			orderId: order.id,
			refundId: refund.id,
			type: 'REFUND',
			referenceId: refund.id,
			grossAmount: -refund.amount,
			commissionRateBps: paymentEntry.commissionRateBps,
			commissionAmount,
			netAmount,
			...(settled ? { availableAmountDiff: netAmount } : { pendingAmountDiff: netAmount }),
			remark: `订单 ${order.orderNo} 退款冲销`,
		},
	})
}

export async function getAccount(merchantId) {
	return prisma.merchantAccount.upsert({ where: { merchantId }, update: {}, create: { merchantId } })
}

export async function listLedger(merchantId, query) {
	const where = {
		merchantId,
		shopId: query.shopId,
		...(query.type ? { type: query.type } : {}),
		...(query.startDate || query.endDate
			? {
					createdAt: {
						...(query.startDate ? { gte: query.startDate } : {}),
						...(query.endDate ? { lte: query.endDate } : {}),
					},
				}
			: {}),
	}
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.merchantLedgerEntry.count({ where }),
		prisma.merchantLedgerEntry.findMany({ where, skip, take: query.pageSize, orderBy: { createdAt: 'desc' } }),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

function csvCell(value) {
	let text = value === null || value === undefined ? '' : String(value)
	if (/^[=+\-@]/.test(text)) text = `'${text}`
	return `"${text.replaceAll('"', '""')}"`
}

export async function exportLedger(merchantId, query) {
	const endDate = query.endDate ?? new Date()
	const startDate = query.startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
	if (endDate <= startDate || endDate.getTime() - startDate.getTime() > 90 * 24 * 60 * 60 * 1000) {
		throw new AppError('导出时间范围必须在 90 天内', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}
	const entries = await prisma.merchantLedgerEntry.findMany({
		where: { merchantId, shopId: query.shopId, createdAt: { gte: startDate, lte: endDate } },
		orderBy: { createdAt: 'desc' },
		take: 10_001,
	})
	if (entries.length > 10_000) {
		throw new AppError('导出数据超过 10000 条，请缩小时间范围', {
			statusCode: 422,
			code: ERROR_CODES.VALIDATION_ERROR,
		})
	}
	const headers = [
		'流水类型',
		'业务ID',
		'订单ID',
		'交易金额(分)',
		'佣金比例(万分比)',
		'佣金(分)',
		'商户净额(分)',
		'待结算变动(分)',
		'可用变动(分)',
		'冻结变动(分)',
		'已提现变动(分)',
		'备注',
		'创建时间',
	]
	const rows = entries.map((entry) => [
		entry.type,
		entry.referenceId,
		entry.orderId,
		entry.grossAmount,
		entry.commissionRateBps,
		entry.commissionAmount,
		entry.netAmount,
		entry.pendingAmountDiff,
		entry.availableAmountDiff,
		entry.frozenAmountDiff,
		entry.withdrawnAmountDiff,
		entry.remark,
		entry.createdAt.toISOString(),
	])
	return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}

export async function createSettlement(merchantId, shopId, input) {
	const existing = await prisma.merchantSettlement.findUnique({
		where: { merchantId_clientRequestId: { merchantId, clientRequestId: input.clientRequestId } },
		include: { orders: true },
	})
	if (existing) return { settlement: existing, duplicated: true }
	try {
		const settlement = await prisma.$transaction(
			async (tx) => {
				const orders = await tx.order.findMany({
					where: {
						shopId,
						status: 'COMPLETED',
						completedAt: { gte: input.periodStart, lte: input.periodEnd },
						merchantSettlementOrder: null,
						merchantLedgerEntries: { some: { type: 'PAYMENT' } },
					},
					include: { merchantLedgerEntries: { where: { type: { in: ['PAYMENT', 'REFUND'] } } } },
					orderBy: { completedAt: 'asc' },
				})
				if (!orders.length) throw conflict('当前周期没有可结算订单')
				const snapshots = orders.map((order) => {
					const grossAmount = order.merchantLedgerEntries
						.filter((entry) => entry.type === 'PAYMENT')
						.reduce((sum, entry) => sum + entry.grossAmount, 0)
					const refundAmount = -order.merchantLedgerEntries
						.filter((entry) => entry.type === 'REFUND')
						.reduce((sum, entry) => sum + entry.grossAmount, 0)
					const commissionAmount = order.merchantLedgerEntries.reduce((sum, entry) => sum + entry.commissionAmount, 0)
					const netAmount = order.merchantLedgerEntries.reduce((sum, entry) => sum + entry.netAmount, 0)
					return { orderId: order.id, shopId: order.shopId, grossAmount, refundAmount, commissionAmount, netAmount }
				})
				const totals = snapshots.reduce(
					(result, item) => ({
						grossAmount: result.grossAmount + item.grossAmount,
						refundAmount: result.refundAmount + item.refundAmount,
						commissionAmount: result.commissionAmount + item.commissionAmount,
						netAmount: result.netAmount + item.netAmount,
					}),
					{ grossAmount: 0, refundAmount: 0, commissionAmount: 0, netAmount: 0 }
				)
				await ensureAccount(tx, merchantId)
				await tx.$queryRaw`SELECT merchantId FROM MerchantAccount WHERE merchantId = ${merchantId} FOR UPDATE`
				const account = await tx.merchantAccount.findUnique({ where: { merchantId } })
				if (account.pendingAmount < totals.netAmount) throw conflict('待结算余额不足，请先进行账务核对')
				const created = await tx.merchantSettlement.create({
					data: {
						settlementNo: createSettlementNo(),
						clientRequestId: input.clientRequestId,
						merchantId,
						periodStart: input.periodStart,
						periodEnd: input.periodEnd,
						...totals,
						orders: { create: snapshots },
					},
				})
				await tx.merchantAccount.update({
					where: { merchantId },
					data: {
						pendingAmount: { decrement: totals.netAmount },
						availableAmount: { increment: totals.netAmount },
					},
				})
				await tx.merchantLedgerEntry.create({
					data: {
						merchantId,
						shopId,
						type: 'SETTLEMENT',
						referenceId: created.id,
						netAmount: totals.netAmount,
						pendingAmountDiff: -totals.netAmount,
						availableAmountDiff: totals.netAmount,
						remark: `结算单 ${created.settlementNo}`,
					},
				})
				return tx.merchantSettlement.findUnique({ where: { id: created.id }, include: { orders: true } })
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { settlement, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const settlement = await prisma.merchantSettlement.findUnique({
				where: { merchantId_clientRequestId: { merchantId, clientRequestId: input.clientRequestId } },
				include: { orders: true },
			})
			if (settlement) return { settlement, duplicated: true }
		}
		throw error
	}
}

export async function listSettlements(merchantId, query) {
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.merchantSettlement.count({ where: { merchantId } }),
		prisma.merchantSettlement.findMany({
			where: { merchantId },
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { orders: true },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function createWithdrawal(merchantId, userId, input) {
	const existing = await prisma.merchantWithdrawal.findUnique({
		where: { merchantId_clientRequestId: { merchantId, clientRequestId: input.clientRequestId } },
	})
	if (existing) return { withdrawal: existing, duplicated: true }
	try {
		const withdrawal = await prisma.$transaction(
			async (tx) => {
				await ensureAccount(tx, merchantId)
				await tx.$queryRaw`SELECT merchantId FROM MerchantAccount WHERE merchantId = ${merchantId} FOR UPDATE`
				const account = await tx.merchantAccount.findUnique({ where: { merchantId } })
				if (account.availableAmount < input.amount) throw conflict('可提现余额不足')
				const created = await tx.merchantWithdrawal.create({
					data: {
						withdrawalNo: createWithdrawalNo(),
						clientRequestId: input.clientRequestId,
						merchantId,
						requestedById: userId,
						amount: input.amount,
						accountInfo: input.accountInfo,
					},
				})
				await tx.merchantAccount.update({
					where: { merchantId },
					data: { availableAmount: { decrement: input.amount }, frozenAmount: { increment: input.amount } },
				})
				await tx.merchantLedgerEntry.create({
					data: {
						merchantId,
						type: 'WITHDRAWAL',
						referenceId: created.id,
						netAmount: -input.amount,
						availableAmountDiff: -input.amount,
						frozenAmountDiff: input.amount,
						remark: `提现申请 ${created.withdrawalNo}`,
					},
				})
				return created
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		return { withdrawal, duplicated: false }
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			const withdrawal = await prisma.merchantWithdrawal.findUnique({
				where: { merchantId_clientRequestId: { merchantId, clientRequestId: input.clientRequestId } },
			})
			if (withdrawal) return { withdrawal, duplicated: true }
		}
		throw error
	}
}

export async function listWithdrawals(where, query) {
	const filter = { ...where, ...(query.status ? { status: query.status } : {}) }
	const skip = (query.page - 1) * query.pageSize
	const [total, items] = await prisma.$transaction([
		prisma.merchantWithdrawal.count({ where: filter }),
		prisma.merchantWithdrawal.findMany({
			where: filter,
			skip,
			take: query.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { merchant: { select: { id: true, name: true, code: true } } },
		}),
	])
	return {
		items,
		pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
	}
}

export async function reviewWithdrawal(id, action, remark, reviewerId) {
	return prisma.$transaction(
		async (tx) => {
			const withdrawal = await tx.merchantWithdrawal.findUnique({ where: { id } })
			if (!withdrawal) throw new AppError('提现申请不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
			await tx.$queryRaw`SELECT merchantId FROM MerchantAccount WHERE merchantId = ${withdrawal.merchantId} FOR UPDATE`
			if (action === 'APPROVE') {
				if (withdrawal.status !== 'PENDING') throw conflict('提现申请已处理')
				return tx.merchantWithdrawal.update({
					where: { id },
					data: { status: 'APPROVED', reviewerId, reviewRemark: remark, reviewedAt: new Date() },
				})
			}
			if (action === 'REJECT') {
				if (withdrawal.status !== 'PENDING') throw conflict('提现申请已处理')
				await tx.merchantAccount.update({
					where: { merchantId: withdrawal.merchantId },
					data: { availableAmount: { increment: withdrawal.amount }, frozenAmount: { decrement: withdrawal.amount } },
				})
				await tx.merchantLedgerEntry.create({
					data: {
						merchantId: withdrawal.merchantId,
						type: 'WITHDRAWAL_RESTORE',
						referenceId: withdrawal.id,
						netAmount: withdrawal.amount,
						availableAmountDiff: withdrawal.amount,
						frozenAmountDiff: -withdrawal.amount,
						remark,
					},
				})
				return tx.merchantWithdrawal.update({
					where: { id },
					data: { status: 'REJECTED', reviewerId, reviewRemark: remark, reviewedAt: new Date() },
				})
			}
			if (withdrawal.status !== 'APPROVED') throw conflict('只有已批准的提现可以完成打款')
			await tx.merchantAccount.update({
				where: { merchantId: withdrawal.merchantId },
				data: { frozenAmount: { decrement: withdrawal.amount }, withdrawnAmount: { increment: withdrawal.amount } },
			})
			await tx.merchantLedgerEntry.create({
				data: {
					merchantId: withdrawal.merchantId,
					type: 'WITHDRAWAL_COMPLETE',
					referenceId: withdrawal.id,
					netAmount: -withdrawal.amount,
					frozenAmountDiff: -withdrawal.amount,
					withdrawnAmountDiff: withdrawal.amount,
					remark,
				},
			})
			return tx.merchantWithdrawal.update({
				where: { id },
				data: { status: 'COMPLETED', reviewerId, reviewRemark: remark, completedAt: new Date() },
			})
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	)
}
