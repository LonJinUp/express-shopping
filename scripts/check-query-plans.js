import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL
const database = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : ''
if (database !== 'express_shop_test') throw new Error(`拒绝检查非测试数据库: ${database || '未配置'}`)

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const checks = [
	{
		name: '商品列表',
		index: 'Product_status_sortOrder_createdAt_idx',
		query:
			"EXPLAIN SELECT id, name FROM Product FORCE INDEX (Product_status_sortOrder_createdAt_idx) WHERE status = 'ACTIVE' ORDER BY sortOrder DESC, createdAt DESC LIMIT 20",
	},
	{
		name: '分类商品列表',
		index: 'Product_categoryId_status_sortOrder_createdAt_idx',
		query:
			"EXPLAIN SELECT id, name FROM Product FORCE INDEX (Product_categoryId_status_sortOrder_createdAt_idx) WHERE categoryId = (SELECT id FROM Category LIMIT 1) AND status = 'ACTIVE' ORDER BY sortOrder DESC, createdAt DESC LIMIT 20",
	},
	{
		name: '商品最低价 SKU',
		index: 'ProductSku_productId_isActive_price_idx',
		query:
			'EXPLAIN SELECT id, price FROM ProductSku FORCE INDEX (ProductSku_productId_isActive_price_idx) WHERE productId = (SELECT id FROM Product LIMIT 1) AND isActive = 1 ORDER BY price ASC LIMIT 1',
	},
]

try {
	await prisma.$executeRawUnsafe('ANALYZE TABLE Product, ProductSku')
	for (const check of checks) {
		const plan = await prisma.$queryRawUnsafe(check.query)
		const main = plan[0]
		const key = main.key ?? main.f6
		const rows = main.rows ?? main.f9
		const extra = main.Extra ?? main.f11 ?? ''
		if (key !== check.index) throw new Error(`${check.name} 未命中预期索引 ${check.index}，实际为 ${key ?? '无'}`)
		if (extra.includes('Using filesort')) throw new Error(`${check.name} 仍在使用 filesort`)
		console.log(`${check.name}: ${key}, rows=${rows}, ${extra}`)
	}
} finally {
	await prisma.$disconnect()
}
