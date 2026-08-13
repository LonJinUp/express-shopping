import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL
const database = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : ''
if (database !== 'express_shop_test') throw new Error(`拒绝写入非测试数据库: ${database || '未配置'}`)

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const productCount = Number.parseInt(process.env.PERF_PRODUCT_COUNT ?? '2000', 10)
const batchSize = 500

async function clearDatabase() {
	const tables = await prisma.$queryRaw`
		SELECT TABLE_NAME AS tableName
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = ${database} AND TABLE_NAME <> '_prisma_migrations'
	`
	await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0')
	try {
		for (const { tableName } of tables) await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${tableName}\``)
	} finally {
		await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1')
	}
}

async function insertBatches(model, rows) {
	for (let offset = 0; offset < rows.length; offset += batchSize) {
		await model.createMany({ data: rows.slice(offset, offset + batchSize) })
	}
}

async function main() {
	if (!Number.isInteger(productCount) || productCount < 100 || productCount > 100_000) {
		throw new Error('PERF_PRODUCT_COUNT 必须是 100 到 100000 之间的整数')
	}
	await clearDatabase()
	const merchant = await prisma.merchant.create({ data: { code: 'DEFAULT', name: '性能测试商户' } })
	const shop = await prisma.shop.create({ data: { merchantId: merchant.id, code: 'DEFAULT', name: '性能测试店铺' } })
	const categories = await Promise.all(
		Array.from({ length: 20 }, (_, index) =>
			prisma.category.create({
				data: { name: `性能分类 ${index + 1}`, slug: `performance-category-${index + 1}`, sortOrder: index },
			})
		)
	)

	await insertBatches(
		prisma.product,
		Array.from({ length: productCount }, (_, index) => ({
			shopId: shop.id,
			categoryId: categories[index % categories.length].id,
			name: `性能测试商品 ${String(index + 1).padStart(6, '0')}`,
			slug: `performance-product-${index + 1}`,
			status: index % 10 === 0 ? 'INACTIVE' : 'ACTIVE',
			sortOrder: index % 100,
		}))
	)
	const products = await prisma.product.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } })
	await insertBatches(
		prisma.productSku,
		products.flatMap((product, index) =>
			[0, 1].map((variant) => ({
				productId: product.id,
				skuCode: `PERF-${index + 1}-${variant + 1}`,
				name: variant ? '升级规格' : '默认规格',
				specifications: { variant: String(variant + 1) },
				price: 1000 + (index % 500) * 10 + variant * 100,
			}))
		)
	)
	const skus = await prisma.productSku.findMany({ select: { id: true } })
	await insertBatches(
		prisma.inventory,
		skus.map(({ id }) => ({ skuId: id, available: 100 }))
	)
	console.log(`性能测试数据已生成：${products.length} 个商品，${skus.length} 个 SKU`)
}

main().finally(() => prisma.$disconnect())
