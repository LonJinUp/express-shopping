import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const checks = [
	{
		name: '订单退款金额越界',
		query: `SELECT id, orderNo FROM \`Order\` WHERE refundedAmount > paidAmount`,
	},
	{
		name: '成功支付金额与订单不一致',
		query: `
			SELECT p.id, p.paymentNo
			FROM Payment p
			JOIN \`Order\` o ON o.id = p.orderId
			WHERE p.status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
			AND p.amount <> o.payableAmount
		`,
	},
	{
		name: '成功支付但订单状态异常',
		query: `
			SELECT p.id, p.paymentNo
			FROM Payment p
			JOIN \`Order\` o ON o.id = p.orderId
			WHERE p.status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
			AND o.status IN ('PENDING_PAYMENT', 'CANCELLED')
		`,
	},
	{
		name: '订单累计退款与成功退款单不一致',
		query: `
			SELECT o.id, o.orderNo
			FROM \`Order\` o
			LEFT JOIN AfterSale a ON a.orderId = o.id
			LEFT JOIN Refund r ON r.afterSaleId = a.id AND r.status = 'SUCCESS'
			GROUP BY o.id, o.orderNo, o.refundedAmount
			HAVING o.refundedAmount <> COALESCE(SUM(r.amount), 0)
		`,
	},
	{
		name: '成功退款但售后未完成',
		query: `
			SELECT r.id, r.refundNo
			FROM Refund r
			JOIN AfterSale a ON a.id = r.afterSaleId
			WHERE r.status = 'SUCCESS' AND a.status <> 'COMPLETED'
		`,
	},
	{
		name: '完成售后但退款单未成功',
		query: `
			SELECT a.id, a.afterSaleNo
			FROM AfterSale a
			LEFT JOIN Refund r ON r.afterSaleId = a.id
			WHERE a.status = 'COMPLETED' AND (r.id IS NULL OR r.status <> 'SUCCESS')
		`,
	},
	{
		name: '成功支付缺少商户收入流水',
		query: `
			SELECT p.id, p.paymentNo
			FROM Payment p
			LEFT JOIN MerchantLedgerEntry l ON l.type = 'PAYMENT' AND l.referenceId = p.id
			WHERE p.status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED') AND l.id IS NULL
		`,
	},
	{
		name: '成功退款缺少商户冲销流水',
		query: `
			SELECT r.id, r.refundNo
			FROM Refund r
			LEFT JOIN MerchantLedgerEntry l ON l.type = 'REFUND' AND l.referenceId = r.id
			WHERE r.status = 'SUCCESS' AND l.id IS NULL
		`,
	},
	{
		name: '商户账户余额与流水不一致',
		query: `
			SELECT a.merchantId
			FROM MerchantAccount a
			LEFT JOIN MerchantLedgerEntry l ON l.merchantId = a.merchantId
			GROUP BY a.merchantId, a.pendingAmount, a.availableAmount, a.frozenAmount, a.withdrawnAmount
			HAVING a.pendingAmount <> COALESCE(SUM(l.pendingAmountDiff), 0)
				OR a.availableAmount <> COALESCE(SUM(l.availableAmountDiff), 0)
				OR a.frozenAmount <> COALESCE(SUM(l.frozenAmountDiff), 0)
				OR a.withdrawnAmount <> COALESCE(SUM(l.withdrawnAmountDiff), 0)
		`,
	},
	{
		name: '结算单金额与订单明细不一致',
		query: `
			SELECT s.id, s.settlementNo
			FROM MerchantSettlement s
			LEFT JOIN MerchantSettlementOrder o ON o.settlementId = s.id
			GROUP BY s.id, s.settlementNo, s.grossAmount, s.refundAmount, s.commissionAmount, s.netAmount
			HAVING s.grossAmount <> COALESCE(SUM(o.grossAmount), 0)
				OR s.refundAmount <> COALESCE(SUM(o.refundAmount), 0)
				OR s.commissionAmount <> COALESCE(SUM(o.commissionAmount), 0)
				OR s.netAmount <> COALESCE(SUM(o.netAmount), 0)
		`,
	},
]

const report = {
	checkedAt: new Date().toISOString(),
	database: new URL(process.env.DATABASE_URL).pathname.slice(1),
	checks: [],
}

try {
	for (const check of checks) {
		const rows = await prisma.$queryRawUnsafe(check.query)
		report.checks.push({ name: check.name, issueCount: rows.length, samples: rows.slice(0, 20) })
	}
	const issueCount = report.checks.reduce((total, check) => total + check.issueCount, 0)
	report.issueCount = issueCount
	console.log(JSON.stringify(report, null, 2))
	if (issueCount > 0) process.exitCode = 1
} finally {
	await prisma.$disconnect()
}
