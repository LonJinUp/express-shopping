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
