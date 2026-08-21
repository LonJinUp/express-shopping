import bcrypt from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/config/prisma.js'
import { createCallbackSignature } from '../../src/middlewares/paymentCallback.js'
import { adjustInventory, createProduct } from '../../src/services/adminCatalogService.js'
import { platformOverview } from '../../src/services/analyticsService.js'
import {
	createAfterSale,
	createRefund,
	mockRefund,
	processRefundCallback,
	requestArbitration,
	resolveArbitration,
	retryRefund,
	reviewAfterSale,
} from '../../src/services/afterSaleService.js'
import { purgeExpiredData } from '../../src/services/dataRetentionService.js'
import { checkoutPreview } from '../../src/services/cartService.js'
import { createOrder } from '../../src/services/orderService.js'
import { mockPay } from '../../src/services/paymentService.js'
import { processNotificationOutbox } from '../../src/services/notificationService.js'
import {
	createSettlement,
	createWithdrawal,
	exportLedger,
	reviewWithdrawal,
} from '../../src/services/merchantFinanceService.js'

async function clearDatabase() {
	const database = new URL(process.env.DATABASE_URL).pathname.slice(1)
	if (database !== 'express_shop_test') throw new Error(`拒绝清理非测试数据库: ${database}`)

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

async function seedBase() {
	const merchant = await prisma.merchant.create({ data: { code: 'DEFAULT', name: '测试商户' } })
	const shop = await prisma.shop.create({ data: { merchantId: merchant.id, code: 'DEFAULT', name: '测试店铺' } })
	const userRole = await prisma.role.create({ data: { code: 'USER', name: '普通用户' } })
	const adminRole = await prisma.role.create({ data: { code: 'ADMIN', name: '管理员' } })
	return { shop, userRole, adminRole }
}

async function createUser(role, suffix) {
	return prisma.user.create({
		data: {
			email: `${suffix}@example.com`,
			nickname: suffix,
			passwordHash: await bcrypt.hash('password123', 4),
			roles: { create: { roleId: role.id } },
			addresses: {
				create: {
					recipientName: suffix,
					phone: '13800000000',
					province: '广东省',
					city: '深圳市',
					district: '南山区',
					detail: '测试路 1 号',
					isDefault: true,
				},
			},
		},
		include: { addresses: true },
	})
}

async function createActiveProduct(operatorId, stock = 1, shopId) {
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	const category = await prisma.category.create({ data: { name: '测试分类', slug: `category-${unique}` } })
	const product = await createProduct(
		{
			categoryId: category.id,
			name: '并发测试商品',
			slug: `product-${unique}`,
			images: [],
			skus: [
				{
					skuCode: `SKU-${unique}`,
					name: '默认规格',
					specifications: { color: 'black' },
					price: 9900,
					stock,
				},
			],
		},
		operatorId,
		shopId
	)
	await prisma.product.update({ where: { id: product.id }, data: { status: 'ACTIVE' } })
	return product.skus[0]
}

function callbackHeaders(body, timestamp = Math.floor(Date.now() / 1000)) {
	return {
		timestamp: String(timestamp),
		signature: createCallbackSignature(env.PAYMENT_CALLBACK_SECRET, timestamp, Buffer.from(JSON.stringify(body))),
	}
}

async function createPendingPayment(user, sku, clientRequestId) {
	const { order } = await createOrder(user.id, {
		source: 'DIRECT',
		clientRequestId: `order-${clientRequestId}`,
		addressId: user.addresses[0].id,
		skuId: sku.id,
		quantity: 1,
	})
	const payment = await prisma.payment.create({
		data: {
			paymentNo: `PAY-${clientRequestId}`,
			orderId: order.id,
			clientRequestId: `payment-${clientRequestId}`,
			channel: 'MOCK',
			amount: order.payableAmount,
		},
	})
	return { order, payment }
}

async function createPaidOrder(user, sku, quantity, clientRequestId) {
	const { order } = await createOrder(user.id, {
		source: 'DIRECT',
		clientRequestId: `order-${clientRequestId}`,
		addressId: user.addresses[0].id,
		skuId: sku.id,
		quantity,
	})
	await mockPay(user.id, { orderId: order.id, clientRequestId: `payment-${clientRequestId}` })
	return prisma.order.findUnique({ where: { id: order.id }, include: { items: true, payments: true } })
}

async function approveRefundOnly(user, order, quantity, clientRequestId, operatorId) {
	const { afterSale } = await createAfterSale(user.id, {
		clientRequestId,
		orderId: order.id,
		type: 'REFUND_ONLY',
		reason: '测试退款',
		items: [{ orderItemId: order.items[0].id, quantity }],
	})
	return reviewAfterSale(afterSale.id, { action: 'APPROVE', remark: '同意退款' }, operatorId)
}

describe.sequential('MySQL integration', () => {
	const app = createApp()

	beforeEach(async () => {
		await clearDatabase()
	})

	afterAll(async () => {
		await clearDatabase()
		await prisma.$disconnect()
	})

	it('registers, logs in, rotates refresh tokens, and enforces admin RBAC', async () => {
		await seedBase()
		const registration = { email: 'buyer@example.com', password: 'password123', nickname: '买家' }
		await request(app).post('/api/v1/auth/register').send(registration).expect(201)
		await request(app).post('/api/v1/auth/register').send(registration).expect(409)

		const login = await request(app)
			.post('/api/v1/auth/login')
			.send({ identifier: registration.email, password: registration.password })
			.expect(200)
		expect(login.body.data.accessToken).toBeTypeOf('string')

		const refresh = await request(app)
			.post('/api/v1/auth/refresh')
			.send({ refreshToken: login.body.data.refreshToken })
			.expect(200)
		expect(refresh.body.data.refreshToken).not.toBe(login.body.data.refreshToken)
		await request(app)
			.get('/api/v1/admin/products')
			.set('authorization', `Bearer ${refresh.body.data.accessToken}`)
			.expect(403)
	})

	it('onboards a merchant and isolates shop management permissions', async () => {
		const { userRole, adminRole } = await seedBase()
		const [applicant, outsider, manager, staff] = await Promise.all([
			createUser(userRole, 'merchant-applicant'),
			createUser(userRole, 'merchant-outsider'),
			createUser(userRole, 'merchant-manager'),
			createUser(userRole, 'merchant-staff'),
		])
		const admin = await createUser(adminRole, 'merchant-reviewer')
		const login = async (email) =>
			request(app).post('/api/v1/auth/login').send({ identifier: email, password: 'password123' }).expect(200)
		const [applicantLogin, outsiderLogin, managerLogin, staffLogin, adminLogin] = await Promise.all([
			login(applicant.email),
			login(outsider.email),
			login(manager.email),
			login(staff.email),
			login(admin.email),
		])
		const applicantToken = applicantLogin.body.data.accessToken
		const outsiderToken = outsiderLogin.body.data.accessToken
		const managerToken = managerLogin.body.data.accessToken
		const staffToken = staffLogin.body.data.accessToken
		const adminToken = adminLogin.body.data.accessToken
		const input = {
			clientRequestId: 'merchant-application-001',
			merchantName: '集成测试商户',
			merchantCode: 'INTEGRATION_MERCHANT',
			shopName: '集成测试店铺',
			shopCode: 'INTEGRATION_SHOP',
			contactName: '测试联系人',
			contactPhone: '13800000001',
		}

		const created = await request(app)
			.post('/api/v1/merchant-applications/create')
			.set('authorization', `Bearer ${applicantToken}`)
			.send(input)
			.expect(201)
		const repeated = await request(app)
			.post('/api/v1/merchant-applications/create')
			.set('authorization', `Bearer ${applicantToken}`)
			.send(input)
			.expect(200)
		expect(repeated.body.data).toMatchObject({
			duplicated: true,
			application: { id: created.body.data.application.id },
		})

		await request(app)
			.post('/api/v1/merchant-applications/create')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ ...input, clientRequestId: 'merchant-application-002' })
			.expect(409)

		const applications = await request(app)
			.get('/api/v1/admin/merchant-applications?status=PENDING')
			.set('authorization', `Bearer ${adminToken}`)
			.expect(200)
		expect(applications.body.data.pagination.total).toBe(1)

		await request(app)
			.post('/api/v1/admin/merchant-applications/review')
			.set('authorization', `Bearer ${adminToken}`)
			.send({ id: created.body.data.application.id, action: 'APPROVE' })
			.expect(200)
		await request(app)
			.post('/api/v1/admin/merchant-applications/review')
			.set('authorization', `Bearer ${adminToken}`)
			.send({ id: created.body.data.application.id, action: 'APPROVE' })
			.expect(409)
		expect(await prisma.notificationOutbox.count({ where: { userId: applicant.id } })).toBe(1)
		expect(await processNotificationOutbox()).toEqual({ processedCount: 1, failedCount: 0 })
		const applicationNotifications = await request(app)
			.get('/api/v1/notifications')
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(applicationNotifications.body.data.items[0]).toMatchObject({
			type: 'MERCHANT_APPLICATION_APPROVED',
			referenceId: created.body.data.application.id,
		})

		const rejectedApplication = await request(app)
			.post('/api/v1/merchant-applications/create')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({
				...input,
				clientRequestId: 'merchant-application-rejected-001',
				merchantName: '待驳回商户',
				merchantCode: 'REJECTED_MERCHANT',
				shopName: '待驳回店铺',
				shopCode: 'REJECTED_SHOP',
			})
			.expect(201)
		await request(app)
			.post('/api/v1/admin/merchant-applications/review')
			.set('authorization', `Bearer ${adminToken}`)
			.send({ id: rejectedApplication.body.data.application.id, action: 'REJECT', reason: '资质材料不完整' })
			.expect(200)
		await request(app)
			.post('/api/v1/admin/merchant-applications/review')
			.set('authorization', `Bearer ${adminToken}`)
			.send({ id: rejectedApplication.body.data.application.id, action: 'REJECT', reason: '重复审核' })
			.expect(409)
		expect(await processNotificationOutbox()).toEqual({ processedCount: 1, failedCount: 0 })
		expect(
			await prisma.userNotification.findFirst({
				where: { userId: outsider.id, referenceId: rejectedApplication.body.data.application.id },
			})
		).toMatchObject({ type: 'MERCHANT_APPLICATION_REJECTED' })

		const shops = await request(app)
			.get('/api/v1/merchant/shops')
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		const shop = shops.body.data[0].merchant.shops[0]
		expect(shops.body.data[0]).toMatchObject({ role: 'OWNER', merchant: { code: 'INTEGRATION_MERCHANT' } })

		await request(app)
			.post('/api/v1/merchant/members/add')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ shopId: shop.id, identifier: manager.email, role: 'ADMIN' })
			.expect(201)
		await request(app)
			.post('/api/v1/merchant/members/add')
			.set('authorization', `Bearer ${managerToken}`)
			.send({ shopId: shop.id, identifier: staff.email, role: 'STAFF' })
			.expect(201)
		await request(app)
			.post('/api/v1/merchant/members/update')
			.set('authorization', `Bearer ${managerToken}`)
			.send({ shopId: shop.id, userId: manager.id, status: 'DISABLED' })
			.expect(403)
		const memberList = await request(app)
			.get(`/api/v1/merchant/members?shopId=${shop.id}`)
			.set('authorization', `Bearer ${staffToken}`)
			.expect(200)
		expect(memberList.body.data).toHaveLength(3)
		await request(app)
			.post('/api/v1/merchant/members/update')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ shopId: shop.id, userId: staff.id, status: 'DISABLED' })
			.expect(200)
		await request(app)
			.get(`/api/v1/merchant/members?shopId=${shop.id}`)
			.set('authorization', `Bearer ${staffToken}`)
			.expect(403)

		await request(app)
			.post('/api/v1/merchant/shops/update')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ id: shop.id, name: '更新后的店铺' })
			.expect(200)
		await request(app)
			.post('/api/v1/merchant/shops/update')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({ id: shop.id, name: '越权修改' })
			.expect(403)
		await new Promise((resolve) => setTimeout(resolve, 50))
		const auditLogs = await request(app)
			.get(`/api/v1/merchant/audit-logs?shopId=${shop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(auditLogs.body.data.pagination.total).toBeGreaterThanOrEqual(4)
		expect(auditLogs.body.data.items.every((item) => item.merchantId === shop.merchantId)).toBe(true)

		const otherMerchant = await prisma.merchant.create({
			data: {
				name: '其他商户',
				code: 'OTHER_MERCHANT',
				members: { create: { userId: outsider.id, role: 'OWNER' } },
				shops: { create: { name: '其他店铺', code: 'OTHER_SHOP' } },
			},
			include: { shops: true },
		})
		const otherShop = otherMerchant.shops[0]
		const category = await prisma.category.create({
			data: { name: '商户隔离分类', slug: 'merchant-isolation-category' },
		})
		const productInput = {
			shopId: shop.id,
			categoryId: category.id,
			name: '商户隔离商品',
			slug: 'merchant-isolation-product',
			images: [],
			skus: [
				{
					skuCode: 'MERCHANT-ISOLATION-SKU',
					name: '默认规格',
					specifications: { color: 'black' },
					price: 19900,
					stock: 5,
				},
			],
		}
		const createdProduct = await request(app)
			.post('/api/v1/merchant/products/create')
			.set('authorization', `Bearer ${applicantToken}`)
			.send(productInput)
			.expect(201)
		const product = createdProduct.body.data
		const sku = product.skus[0]
		const now = Date.now()
		const couponInput = {
			shopId: shop.id,
			code: 'MERCHANT_PRODUCT_COUPON',
			name: '商户指定商品券',
			scope: 'PRODUCT',
			thresholdAmount: 10000,
			discountAmount: 1000,
			totalQuantity: 100,
			startsAt: new Date(now - 60_000).toISOString(),
			endsAt: new Date(now + 86_400_000).toISOString(),
			productIds: [product.id],
			categoryIds: [],
		}
		await request(app)
			.post('/api/v1/merchant/coupons/create')
			.set('authorization', `Bearer ${applicantToken}`)
			.send(couponInput)
			.expect(201)
		const merchantCoupons = await request(app)
			.get(`/api/v1/merchant/coupons?shopId=${shop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(merchantCoupons.body.data.pagination.total).toBe(1)
		await request(app)
			.post('/api/v1/merchant/coupons/create')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({ ...couponInput, shopId: otherShop.id, code: 'CROSS_SHOP_COUPON' })
			.expect(422)

		await request(app)
			.post('/api/v1/merchant/shipping-templates/create')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ shopId: shop.id, name: '商户默认运费', baseFee: 1200, isDefault: true, regionRules: [] })
			.expect(201)
		const shippingTemplates = await request(app)
			.get(`/api/v1/merchant/shipping-templates?shopId=${otherShop.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(200)
		expect(shippingTemplates.body.data).toHaveLength(0)

		await request(app)
			.get(`/api/v1/merchant/products?shopId=${shop.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(403)
		const isolatedProducts = await request(app)
			.get(`/api/v1/merchant/products?shopId=${otherShop.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(200)
		expect(isolatedProducts.body.data.pagination.total).toBe(0)
		await request(app)
			.post('/api/v1/merchant/skus/inventory/adjust')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({ shopId: otherShop.id, id: sku.id, difference: 1, remark: '跨店库存调整' })
			.expect(404)

		await request(app)
			.post('/api/v1/merchant/products/status')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ shopId: shop.id, id: product.id, status: 'ACTIVE' })
			.expect(200)
		const { order } = await createOrder(outsider.id, {
			source: 'DIRECT',
			clientRequestId: 'merchant-isolation-order',
			addressId: outsider.addresses[0].id,
			skuId: sku.id,
			quantity: 1,
		})
		await mockPay(outsider.id, { orderId: order.id, clientRequestId: 'merchant-isolation-payment' })
		const repeatedPayment = await mockPay(outsider.id, {
			orderId: order.id,
			clientRequestId: 'merchant-isolation-payment',
		})
		expect(repeatedPayment.duplicated).toBe(true)
		const merchantOrderOutboxes = await prisma.notificationOutbox.findMany({
			where: { eventKey: `MERCHANT_ORDER_PAID:${order.id}` },
			orderBy: { userId: 'asc' },
		})
		expect(merchantOrderOutboxes.map((item) => item.userId)).toEqual([applicant.id, manager.id].sort())
		expect(merchantOrderOutboxes.some((item) => item.userId === staff.id)).toBe(false)
		expect(await processNotificationOutbox()).toEqual({ processedCount: 3, failedCount: 0 })
		expect(
			await prisma.userNotification.count({
				where: { userId: { in: [applicant.id, manager.id] }, eventKey: `MERCHANT_ORDER_PAID:${order.id}` },
			})
		).toBe(2)
		const paidOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } })

		const merchantDashboard = await request(app)
			.get(`/api/v1/merchant/analytics/dashboard?shopId=${shop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(merchantDashboard.body.data).toMatchObject({
			orderCount: 1,
			paidOrderCount: 1,
			salesAmount: paidOrder.paidAmount,
		})
		expect(merchantDashboard.body.data.finance).toMatchObject({
			paymentGross: paidOrder.paidAmount,
			refundAmount: 0,
			commissionAmount: Math.floor((paidOrder.paidAmount * 500) / 10_000),
			merchantNet: paidOrder.paidAmount - Math.floor((paidOrder.paidAmount * 500) / 10_000),
		})
		await request(app)
			.get(`/api/v1/merchant/finance/account?shopId=${shop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		await request(app)
			.get(`/api/v1/merchant/finance/account?shopId=${otherShop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(403)
		const otherDashboard = await request(app)
			.get(`/api/v1/merchant/analytics/dashboard?shopId=${otherShop.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(200)
		expect(otherDashboard.body.data).toMatchObject({ orderCount: 0, paidOrderCount: 0, salesAmount: 0 })
		const startDate = encodeURIComponent(new Date(now - 86_400_000).toISOString())
		const endDate = encodeURIComponent(new Date(now + 86_400_000).toISOString())
		const merchantExport = await request(app)
			.get(`/api/v1/merchant/orders/export?shopId=${shop.id}&startDate=${startDate}&endDate=${endDate}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(merchantExport.text).toContain(order.orderNo)
		const otherExport = await request(app)
			.get(`/api/v1/merchant/orders/export?shopId=${otherShop.id}&startDate=${startDate}&endDate=${endDate}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(200)
		expect(otherExport.text).not.toContain(order.orderNo)

		const { afterSale } = await createAfterSale(outsider.id, {
			clientRequestId: 'merchant-isolation-after-sale',
			orderId: order.id,
			type: 'REFUND_ONLY',
			reason: '商户售后隔离测试',
			items: [{ orderItemId: paidOrder.items[0].id, quantity: 1 }],
		})
		const merchantAfterSales = await request(app)
			.get(`/api/v1/merchant/after-sales?shopId=${shop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(merchantAfterSales.body.data.pagination.total).toBe(1)
		await request(app)
			.get(`/api/v1/merchant/after-sales/detail?shopId=${otherShop.id}&id=${afterSale.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(404)
		await request(app)
			.post('/api/v1/merchant/after-sales/review')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({ shopId: otherShop.id, id: afterSale.id, action: 'REJECT', remark: '越权审核' })
			.expect(409)
		await request(app)
			.post('/api/v1/merchant/after-sales/review')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ shopId: shop.id, id: afterSale.id, action: 'REJECT', remark: '恢复订单继续履约' })
			.expect(200)

		const merchantOrders = await request(app)
			.get(`/api/v1/merchant/orders?shopId=${shop.id}`)
			.set('authorization', `Bearer ${applicantToken}`)
			.expect(200)
		expect(merchantOrders.body.data.pagination.total).toBe(1)
		const otherOrders = await request(app)
			.get(`/api/v1/merchant/orders?shopId=${otherShop.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(200)
		expect(otherOrders.body.data.pagination.total).toBe(0)
		await request(app)
			.get(`/api/v1/merchant/orders/detail?shopId=${otherShop.id}&id=${order.id}`)
			.set('authorization', `Bearer ${outsiderToken}`)
			.expect(404)
		await request(app)
			.post('/api/v1/merchant/orders/accept')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({ shopId: otherShop.id, id: order.id })
			.expect(409)
		await request(app)
			.post('/api/v1/merchant/orders/accept')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({ shopId: shop.id, id: order.id })
			.expect(200)
		await request(app)
			.post('/api/v1/merchant/orders/ship')
			.set('authorization', `Bearer ${applicantToken}`)
			.send({
				shopId: shop.id,
				id: order.id,
				carrierCode: 'SF',
				carrierName: '顺丰速运',
				trackingNumber: 'SF-MERCHANT-001',
			})
			.expect(200)

		expect(await prisma.merchant.count({ where: { code: 'INTEGRATION_MERCHANT' } })).toBe(1)
		expect(await prisma.merchantMember.count({ where: { userId: applicant.id, role: 'OWNER' } })).toBe(1)
	})

	it('creates product inventory and rejects adjustments below zero', async () => {
		const { adminRole } = await seedBase()
		const admin = await createUser(adminRole, 'inventory-admin')
		const sku = await createActiveProduct(admin.id, 3)

		const inventory = await adjustInventory(sku.id, -2, '集成测试扣减', admin.id)
		expect(inventory.available).toBe(1)
		await expect(adjustInventory(sku.id, -2, '不能扣成负数', admin.id)).rejects.toMatchObject({ statusCode: 422 })
		expect(await prisma.inventoryLog.count({ where: { skuId: sku.id } })).toBe(2)
	})

	it('returns the same order for a repeated client request', async () => {
		const { userRole } = await seedBase()
		const user = await createUser(userRole, 'idempotent-buyer')
		const sku = await createActiveProduct(user.id, 2)
		const input = {
			source: 'DIRECT',
			clientRequestId: 'same-request-001',
			addressId: user.addresses[0].id,
			skuId: sku.id,
			quantity: 1,
		}

		const first = await createOrder(user.id, input)
		const second = await createOrder(user.id, input)
		expect(first.duplicated).toBe(false)
		expect(second).toMatchObject({ duplicated: true, order: { id: first.order.id } })
		expect(await prisma.order.count()).toBe(1)
		expect(await prisma.inventory.findUnique({ where: { skuId: sku.id } })).toMatchObject({ available: 1, locked: 1 })
	})

	it('prevents concurrent orders from overselling the last item', async () => {
		const { userRole } = await seedBase()
		const [firstUser, secondUser] = await Promise.all([
			createUser(userRole, 'concurrent-a'),
			createUser(userRole, 'concurrent-b'),
		])
		const sku = await createActiveProduct(firstUser.id, 1)
		const orderInput = (user, clientRequestId) => ({
			source: 'DIRECT',
			clientRequestId,
			addressId: user.addresses[0].id,
			skuId: sku.id,
			quantity: 1,
		})

		const results = await Promise.allSettled([
			createOrder(firstUser.id, orderInput(firstUser, 'concurrent-request-a')),
			createOrder(secondUser.id, orderInput(secondUser, 'concurrent-request-b')),
		])
		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
		expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
		expect(await prisma.order.count()).toBe(1)
		expect(await prisma.inventory.findUnique({ where: { skuId: sku.id } })).toMatchObject({ available: 0, locked: 1 })
	})

	it('processes a repeated payment callback only once', async () => {
		const { userRole } = await seedBase()
		const user = await createUser(userRole, 'callback-buyer')
		const sku = await createActiveProduct(user.id, 1)
		const { order, payment } = await createPendingPayment(user, sku, 'callback-001')
		const body = {
			channel: 'mock',
			eventId: 'payment-event-001',
			paymentNo: payment.paymentNo,
			transactionId: 'transaction-001',
			status: 'SUCCESS',
			amount: payment.amount,
		}
		const headers = callbackHeaders(body)
		const sendCallback = () =>
			request(app)
				.post('/api/v1/payments/callback')
				.set('x-payment-timestamp', headers.timestamp)
				.set('x-payment-signature', headers.signature)
				.send(body)

		const first = await sendCallback().expect(200)
		const second = await sendCallback().expect(200)
		expect(first.body.data).toEqual({ accepted: true, duplicated: false })
		expect(second.body.data).toEqual({ accepted: true, duplicated: true })
		expect(await prisma.paymentCallbackLog.count()).toBe(1)
		expect(await prisma.inventoryLog.count({ where: { skuId: sku.id, type: 'ORDER_DEDUCT' } })).toBe(1)
		expect(await prisma.inventory.findUnique({ where: { skuId: sku.id } })).toMatchObject({ available: 0, locked: 0 })
		expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({
			status: 'PAID',
			paidAmount: payment.amount,
		})
	})

	it('delivers idempotent in-app notifications and isolates each user inbox', async () => {
		const { userRole } = await seedBase()
		const [buyer, outsider] = await Promise.all([
			createUser(userRole, 'notification-buyer'),
			createUser(userRole, 'notification-outsider'),
		])
		const sku = await createActiveProduct(buyer.id, 1)
		const order = await createPaidOrder(buyer, sku, 1, 'notification-order')

		expect(await prisma.notificationOutbox.count()).toBe(1)
		expect(await processNotificationOutbox()).toEqual({ processedCount: 1, failedCount: 0 })
		expect(await processNotificationOutbox()).toEqual({ processedCount: 0, failedCount: 0 })
		const notification = await prisma.userNotification.findFirst({ where: { userId: buyer.id } })
		expect(notification).toMatchObject({
			eventKey: `ORDER_PAID:${order.id}`,
			type: 'ORDER_PAID',
			referenceId: order.id,
			readAt: null,
		})
		expect(await prisma.userNotification.count()).toBe(1)
		expect(await prisma.notificationOutbox.findFirst()).toMatchObject({ status: 'SENT', attempts: 1 })

		const login = async (user) => {
			const response = await request(app)
				.post('/api/v1/auth/login')
				.send({ identifier: user.email, password: 'password123' })
				.expect(200)
			return response.body.data.accessToken
		}
		const [buyerToken, outsiderToken] = await Promise.all([login(buyer), login(outsider)])
		const inbox = await request(app)
			.get('/api/v1/notifications?unreadOnly=true')
			.set('authorization', `Bearer ${buyerToken}`)
			.expect(200)
		expect(inbox.body.data.pagination.total).toBe(1)
		expect(inbox.body.data.items[0].id).toBe(notification.id)

		await request(app)
			.post('/api/v1/notifications/read')
			.set('authorization', `Bearer ${outsiderToken}`)
			.send({ id: notification.id })
			.expect(200)
		expect((await prisma.userNotification.findUnique({ where: { id: notification.id } })).readAt).toBeNull()

		await request(app)
			.post('/api/v1/notifications/read')
			.set('authorization', `Bearer ${buyerToken}`)
			.send({ id: notification.id })
			.expect(200)
		const unread = await request(app)
			.get('/api/v1/notifications/unread-count')
			.set('authorization', `Bearer ${buyerToken}`)
			.expect(200)
		expect(unread.body.data.count).toBe(0)
	})

	it('retries failed notification delivery until the attempt limit is exhausted', async () => {
		const { userRole, adminRole } = await seedBase()
		const [user, admin] = await Promise.all([
			createUser(userRole, 'notification-retry'),
			createUser(adminRole, 'notification-admin'),
		])
		const outbox = await prisma.notificationOutbox.create({
			data: {
				channel: 'UNAVAILABLE_CHANNEL',
				eventKey: 'RETRY_TEST:event-001',
				userId: user.id,
				type: 'RETRY_TEST',
				payload: { title: '重试测试', content: '渠道当前不可用' },
				maxAttempts: 2,
			},
		})

		expect(await processNotificationOutbox()).toEqual({ processedCount: 0, failedCount: 1 })
		expect(await prisma.notificationOutbox.findUnique({ where: { id: outbox.id } })).toMatchObject({
			status: 'FAILED',
			attempts: 1,
		})
		await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { nextAttemptAt: new Date(0) } })
		expect(await processNotificationOutbox()).toEqual({ processedCount: 0, failedCount: 1 })
		expect(await prisma.notificationOutbox.findUnique({ where: { id: outbox.id } })).toMatchObject({
			status: 'EXHAUSTED',
			attempts: 2,
		})
		expect(await processNotificationOutbox()).toEqual({ processedCount: 0, failedCount: 0 })

		const login = async (account) => {
			const response = await request(app)
				.post('/api/v1/auth/login')
				.send({ identifier: account.email, password: 'password123' })
				.expect(200)
			return response.body.data.accessToken
		}
		const [userToken, adminToken] = await Promise.all([login(user), login(admin)])
		await request(app)
			.get('/api/v1/admin/notification-outbox?status=EXHAUSTED')
			.set('authorization', `Bearer ${userToken}`)
			.expect(403)
		const list = await request(app)
			.get('/api/v1/admin/notification-outbox?status=EXHAUSTED')
			.set('authorization', `Bearer ${adminToken}`)
			.expect(200)
		expect(list.body.data.pagination.total).toBe(1)
		expect(list.body.data.summary.EXHAUSTED).toBe(1)
		expect(list.body.data.items[0]).toMatchObject({ id: outbox.id, user: { id: user.id } })

		const retried = await request(app)
			.post('/api/v1/admin/notification-outbox/retry')
			.set('authorization', `Bearer ${adminToken}`)
			.send({ id: outbox.id })
			.expect(200)
		expect(retried.body.data).toMatchObject({ status: 'PENDING', attempts: 0, lastError: null })
		await request(app)
			.post('/api/v1/admin/notification-outbox/retry')
			.set('authorization', `Bearer ${adminToken}`)
			.send({ id: outbox.id })
			.expect(409)
		expect(await processNotificationOutbox()).toEqual({ processedCount: 0, failedCount: 1 })
		expect(await prisma.notificationOutbox.findUnique({ where: { id: outbox.id } })).toMatchObject({
			status: 'FAILED',
			attempts: 1,
		})
	})

	it('handles concurrent delivery of the same payment callback', async () => {
		const { userRole } = await seedBase()
		const user = await createUser(userRole, 'concurrent-callback-buyer')
		const sku = await createActiveProduct(user.id, 1)
		const { payment } = await createPendingPayment(user, sku, 'callback-002')
		const body = {
			channel: 'mock',
			eventId: 'payment-event-002',
			paymentNo: payment.paymentNo,
			transactionId: 'transaction-002',
			status: 'SUCCESS',
			amount: payment.amount,
		}
		const headers = callbackHeaders(body)
		const sendCallback = () =>
			request(app)
				.post('/api/v1/payments/callback')
				.set('x-payment-timestamp', headers.timestamp)
				.set('x-payment-signature', headers.signature)
				.send(body)

		const responses = await Promise.all([sendCallback(), sendCallback()])
		expect(responses.map(({ status }) => status)).toEqual([200, 200])
		expect(responses.filter(({ body }) => body.data.duplicated)).toHaveLength(1)
		expect(await prisma.paymentCallbackLog.count()).toBe(1)
		expect(await prisma.inventoryLog.count({ where: { skuId: sku.id, type: 'ORDER_DEDUCT' } })).toBe(1)
		expect(await prisma.inventory.findUnique({ where: { skuId: sku.id } })).toMatchObject({ available: 0, locked: 0 })
	})

	it('completes partial refunds without exceeding paid amount and restores stock proportionally', async () => {
		const { shop, userRole, adminRole } = await seedBase()
		const [user, admin] = await Promise.all([
			createUser(userRole, 'partial-refund-buyer'),
			createUser(adminRole, 'partial-refund-admin'),
		])
		const sku = await createActiveProduct(admin.id, 2)
		const order = await createPaidOrder(user, sku, 2, 'partial-refund')

		const firstAfterSale = await approveRefundOnly(user, order, 1, 'after-sale-partial-001', admin.id)
		await mockRefund(firstAfterSale.id, 'refund-partial-001', admin.id)
		const partiallyRefundedOrder = await prisma.order.findUnique({ where: { id: order.id } })
		expect(partiallyRefundedOrder).toMatchObject({ status: 'PAID', paidAmount: 19_800, refundedAmount: 9_900 })
		expect(await prisma.payment.findFirst({ where: { orderId: order.id } })).toMatchObject({
			status: 'PARTIALLY_REFUNDED',
		})
		expect(await prisma.inventory.findUnique({ where: { skuId: sku.id } })).toMatchObject({ available: 1, locked: 0 })

		const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } })
		const secondAfterSale = await approveRefundOnly(user, refreshedOrder, 1, 'after-sale-partial-002', admin.id)
		await mockRefund(secondAfterSale.id, 'refund-partial-002', admin.id)
		expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({
			status: 'REFUNDED',
			paidAmount: 19_800,
			refundedAmount: 19_800,
		})
		expect(await prisma.payment.findFirst({ where: { orderId: order.id } })).toMatchObject({ status: 'REFUNDED' })
		expect(await prisma.inventory.findUnique({ where: { skuId: sku.id } })).toMatchObject({ available: 2, locked: 0 })
		expect(await prisma.merchantAccount.findUnique({ where: { merchantId: shop.merchantId } })).toMatchObject({
			pendingAmount: 0,
		})
		expect(await prisma.merchantLedgerEntry.count({ where: { orderId: order.id } })).toBe(3)
	})

	it('retries a failed channel refund without creating another refund record', async () => {
		const { userRole, adminRole } = await seedBase()
		const [user, admin] = await Promise.all([
			createUser(userRole, 'retry-refund-buyer'),
			createUser(adminRole, 'retry-refund-admin'),
		])
		const sku = await createActiveProduct(admin.id, 1)
		const order = await createPaidOrder(user, sku, 1, 'retry-refund')
		const afterSale = await approveRefundOnly(user, order, 1, 'after-sale-retry-001', admin.id)
		const { refund } = await createRefund(
			afterSale.id,
			{ clientRequestId: 'refund-retry-001', channel: 'MOCK' },
			admin.id
		)

		await processRefundCallback('MOCK', {
			eventId: 'refund-failed-event-001',
			refundNo: refund.refundNo,
			transactionId: 'failed-refund-transaction-001',
			status: 'FAILED',
			amount: refund.amount,
		})
		expect(await prisma.refund.findUnique({ where: { id: refund.id } })).toMatchObject({ status: 'FAILED' })

		const retried = await retryRefund(afterSale.id, admin.id)
		expect(retried).toMatchObject({ id: refund.id, status: 'PENDING', retryCount: 1, transactionId: null })
		expect(await prisma.refund.count({ where: { afterSaleId: afterSale.id } })).toBe(1)
	})

	it('allows only one concurrent after-sale application for an order', async () => {
		const { userRole, adminRole } = await seedBase()
		const [user, admin] = await Promise.all([
			createUser(userRole, 'concurrent-after-sale-buyer'),
			createUser(adminRole, 'concurrent-after-sale-admin'),
		])
		const sku = await createActiveProduct(admin.id, 1)
		const order = await createPaidOrder(user, sku, 1, 'concurrent-after-sale')
		const input = (clientRequestId) => ({
			clientRequestId,
			orderId: order.id,
			type: 'REFUND_ONLY',
			reason: '并发售后测试',
			items: [{ orderItemId: order.items[0].id, quantity: 1 }],
		})

		const results = await Promise.allSettled([
			createAfterSale(user.id, input('concurrent-after-sale-001')),
			createAfterSale(user.id, input('concurrent-after-sale-002')),
		])
		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
		expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
		expect(await prisma.afterSale.count({ where: { orderId: order.id } })).toBe(1)
	})

	it('lets the buyer request arbitration and the platform override a merchant rejection', async () => {
		const { userRole, adminRole } = await seedBase()
		const [buyer, outsider, admin] = await Promise.all([
			createUser(userRole, 'arbitration-buyer'),
			createUser(userRole, 'arbitration-outsider'),
			createUser(adminRole, 'arbitration-admin'),
		])
		const sku = await createActiveProduct(admin.id, 1)
		const order = await createPaidOrder(buyer, sku, 1, 'arbitration-order')
		const { afterSale } = await createAfterSale(buyer.id, {
			clientRequestId: 'arbitration-after-sale-001',
			orderId: order.id,
			type: 'REFUND_ONLY',
			reason: '商品与描述不符',
			items: [{ orderItemId: order.items[0].id, quantity: 1 }],
		})
		await reviewAfterSale(afterSale.id, { action: 'REJECT', remark: '商户不同意退款' }, admin.id)

		await expect(requestArbitration(outsider.id, afterSale.id, { reason: '尝试介入他人售后' })).rejects.toMatchObject({
			statusCode: 404,
		})
		const arbitration = await requestArbitration(buyer.id, afterSale.id, {
			reason: '申请平台重新核实商品情况',
			evidence: ['https://example.com/evidence.jpg'],
		})
		expect(arbitration).toMatchObject({ afterSaleId: afterSale.id, userId: buyer.id, status: 'PENDING' })
		expect(await prisma.afterSale.findUnique({ where: { id: afterSale.id } })).toMatchObject({
			status: 'ARBITRATING',
		})

		const userLogin = await request(app)
			.post('/api/v1/auth/login')
			.send({ identifier: buyer.email, password: 'password123' })
			.expect(200)
		await request(app)
			.post('/api/v1/admin/after-sales/arbitrations/resolve')
			.set('authorization', `Bearer ${userLogin.body.data.accessToken}`)
			.send({ id: arbitration.id, decision: 'APPROVE', remark: '越权仲裁' })
			.expect(403)

		const resolved = await resolveArbitration(
			arbitration.id,
			{ decision: 'APPROVE', approvedAmount: afterSale.requestedAmount, remark: '平台核实后支持买家退款' },
			admin.id
		)
		expect(resolved).toMatchObject({ status: 'REFUNDING', approvedAmount: afterSale.requestedAmount })
		expect(resolved.arbitration).toMatchObject({ status: 'RESOLVED', decision: 'APPROVE', resolvedById: admin.id })
		expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: 'REFUNDING' })
		await expect(
			resolveArbitration(arbitration.id, { decision: 'REJECT', remark: '重复处理仲裁' }, admin.id)
		).rejects.toMatchObject({ statusCode: 409 })
	})

	it('previews and creates idempotent child orders for a cross-shop cart', async () => {
		const { shop, userRole } = await seedBase()
		const user = await createUser(userRole, 'cross-shop-buyer')
		const secondMerchant = await prisma.merchant.create({ data: { code: 'SECOND', name: '第二商户' } })
		const secondShop = await prisma.shop.create({
			data: { merchantId: secondMerchant.id, code: 'SECOND', name: '第二店铺' },
		})
		const [firstSku, secondSku] = await Promise.all([
			createActiveProduct(user.id, 3, shop.id),
			createActiveProduct(user.id, 4, secondShop.id),
		])
		await prisma.cartItem.createMany({
			data: [
				{ userId: user.id, skuId: firstSku.id, quantity: 1 },
				{ userId: user.id, skuId: secondSku.id, quantity: 2 },
			],
		})
		const cartItems = await prisma.cartItem.findMany({ where: { userId: user.id }, orderBy: { skuId: 'asc' } })
		const cartItemIds = cartItems.map((item) => item.id)

		const preview = await checkoutPreview(user.id, {
			addressId: user.addresses[0].id,
			itemIds: cartItemIds,
		})
		expect(preview.shops).toHaveLength(2)
		expect(preview.payableAmount).toBe(9900 * 3)

		const input = {
			source: 'CART',
			clientRequestId: 'cross-shop-order-001',
			addressId: user.addresses[0].id,
			cartItemIds,
		}
		const first = await createOrder(user.id, input)
		const second = await createOrder(user.id, input)
		expect(first.duplicated).toBe(false)
		expect(second.duplicated).toBe(true)
		expect(first.order.id).toBe(second.order.id)
		expect(first.order.orders).toHaveLength(2)
		expect(new Set(first.order.orders.map((order) => order.shopId))).toEqual(new Set([shop.id, secondShop.id]))
		expect(await prisma.platformOrder.count()).toBe(1)
		expect(await prisma.order.count()).toBe(2)
		expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(0)
		expect(await prisma.inventory.findUnique({ where: { skuId: firstSku.id } })).toMatchObject({
			available: 2,
			locked: 1,
		})
		expect(await prisma.inventory.findUnique({ where: { skuId: secondSku.id } })).toMatchObject({
			available: 2,
			locked: 2,
		})
	})

	it('records commission, settles completed orders, and processes a withdrawal exactly once', async () => {
		const { shop, userRole, adminRole } = await seedBase()
		const [buyer, admin] = await Promise.all([
			createUser(userRole, 'finance-buyer'),
			createUser(adminRole, 'finance-admin'),
		])
		const sku = await createActiveProduct(admin.id, 1, shop.id)
		const order = await createPaidOrder(buyer, sku, 1, 'finance-order')
		const paymentEntry = await prisma.merchantLedgerEntry.findFirst({ where: { orderId: order.id, type: 'PAYMENT' } })
		expect(paymentEntry).toMatchObject({
			grossAmount: 9900,
			commissionRateBps: 500,
			commissionAmount: 495,
			netAmount: 9405,
			pendingAmountDiff: 9405,
		})
		const overview = await platformOverview({
			startDate: new Date(Date.now() - 60_000),
			endDate: new Date(Date.now() + 60_000),
			limit: 10,
		})
		expect(overview.transactions).toMatchObject({
			paymentCount: 1,
			paymentAmount: 9900,
			refundAmount: 0,
			commissionAmount: 495,
			merchantNetAmount: 9405,
		})
		expect(overview.merchantLiabilities).toMatchObject({ pendingAmount: 9405, availableAmount: 0 })
		expect(overview.merchantRanking[0]).toMatchObject({
			merchant: { id: shop.merchantId },
			commissionAmount: 495,
			netAmount: 9405,
		})
		const ledgerCsv = await exportLedger(shop.merchantId, {
			shopId: shop.id,
			startDate: new Date(Date.now() - 60_000),
			endDate: new Date(Date.now() + 60_000),
		})
		expect(ledgerCsv).toContain('PAYMENT')
		expect(ledgerCsv).toContain(order.id)
		expect(await prisma.merchantAccount.findUnique({ where: { merchantId: shop.merchantId } })).toMatchObject({
			pendingAmount: 9405,
			availableAmount: 0,
		})

		const completedAt = new Date()
		await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', completedAt } })
		const settlementInput = {
			clientRequestId: 'finance-settlement-001',
			periodStart: new Date(completedAt.getTime() - 60_000),
			periodEnd: new Date(completedAt.getTime() + 60_000),
		}
		const firstSettlement = await createSettlement(shop.merchantId, shop.id, settlementInput)
		const secondSettlement = await createSettlement(shop.merchantId, shop.id, settlementInput)
		expect(firstSettlement.duplicated).toBe(false)
		expect(secondSettlement.duplicated).toBe(true)
		expect(firstSettlement.settlement).toMatchObject({
			grossAmount: 9900,
			refundAmount: 0,
			commissionAmount: 495,
			netAmount: 9405,
		})

		const withdrawalInput = {
			clientRequestId: 'finance-withdrawal-001',
			amount: 5000,
			accountInfo: { bankName: '测试银行', accountName: '测试商户', accountNo: '6222000012345678' },
		}
		const firstWithdrawal = await createWithdrawal(shop.merchantId, admin.id, withdrawalInput)
		const secondWithdrawal = await createWithdrawal(shop.merchantId, admin.id, withdrawalInput)
		expect(firstWithdrawal.duplicated).toBe(false)
		expect(secondWithdrawal.duplicated).toBe(true)
		await reviewWithdrawal(firstWithdrawal.withdrawal.id, 'APPROVE', '审核通过', admin.id)
		await reviewWithdrawal(firstWithdrawal.withdrawal.id, 'COMPLETE', '银行打款完成', admin.id)
		const rejectedWithdrawal = await createWithdrawal(shop.merchantId, admin.id, {
			clientRequestId: 'finance-withdrawal-rejected-001',
			amount: 1000,
			accountInfo: { bankName: '测试银行', accountName: '测试商户', accountNo: '6222000099999999' },
		})
		await reviewWithdrawal(rejectedWithdrawal.withdrawal.id, 'REJECT', '收款账户信息不完整', admin.id)
		await expect(
			reviewWithdrawal(rejectedWithdrawal.withdrawal.id, 'REJECT', '重复驳回', admin.id)
		).rejects.toMatchObject({ statusCode: 409 })
		expect(await prisma.merchantAccount.findUnique({ where: { merchantId: shop.merchantId } })).toMatchObject({
			pendingAmount: 0,
			availableAmount: 4405,
			frozenAmount: 0,
			withdrawnAmount: 5000,
		})
		expect(await prisma.merchantLedgerEntry.count({ where: { merchantId: shop.merchantId } })).toBe(6)
		expect(
			await prisma.notificationOutbox.count({
				where: {
					userId: admin.id,
					type: { in: ['WITHDRAWAL_APPROVED', 'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_REJECTED'] },
				},
			})
		).toBe(3)
		expect(await processNotificationOutbox()).toEqual({ processedCount: 4, failedCount: 0 })
		const financeNotifications = await prisma.userNotification.findMany({
			where: { userId: admin.id, referenceType: 'MERCHANT_WITHDRAWAL' },
		})
		expect(financeNotifications.map((item) => item.type).sort()).toEqual([
			'WITHDRAWAL_APPROVED',
			'WITHDRAWAL_COMPLETED',
			'WITHDRAWAL_REJECTED',
		])
	})

	it('purges expired personal and operational data while retaining current records', async () => {
		const { userRole } = await seedBase()
		const user = await createUser(userRole, 'retention-user')
		const sku = await createActiveProduct(user.id, 1)
		const old = new Date('2024-01-01T00:00:00.000Z')
		const current = new Date('2026-08-13T00:00:00.000Z')
		const records = await Promise.all([
			prisma.userSession.create({
				data: { userId: user.id, refreshTokenHash: 'a'.repeat(64), expiresAt: old },
			}),
			prisma.userSession.create({
				data: { userId: user.id, refreshTokenHash: 'b'.repeat(64), expiresAt: new Date('2027-01-01') },
			}),
			prisma.passwordResetToken.create({
				data: { userId: user.id, tokenHash: 'c'.repeat(64), expiresAt: old },
			}),
			prisma.browsingHistory.create({
				data: { userId: user.id, productId: sku.productId, viewedAt: old },
			}),
			prisma.paymentCallbackLog.create({
				data: { channel: 'MOCK', eventId: 'old-callback', status: 'PROCESSED', payload: {}, createdAt: old },
			}),
			prisma.auditLog.create({
				data: {
					operatorId: user.id,
					method: 'POST',
					path: '/test',
					action: 'TEST',
					requestId: 'retention-request',
					statusCode: 200,
					createdAt: old,
				},
			}),
		])

		const result = await purgeExpiredData(current, {
			SESSION_RETENTION_DAYS: 90,
			PASSWORD_RESET_RETENTION_DAYS: 30,
			BROWSING_HISTORY_RETENTION_DAYS: 180,
			CALLBACK_LOG_RETENTION_DAYS: 365,
			AUDIT_LOG_RETENTION_DAYS: 730,
		})
		expect(result).toMatchObject({
			sessions: 1,
			passwordResetTokens: 1,
			browsingHistory: 1,
			paymentCallbacks: 1,
			auditLogs: 1,
		})
		expect(await prisma.userSession.findUnique({ where: { id: records[0].id } })).toBeNull()
		expect(await prisma.userSession.findUnique({ where: { id: records[1].id } })).not.toBeNull()
		expect(await prisma.order.count()).toBe(0)
	})
})
