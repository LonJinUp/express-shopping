import bcrypt from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/config/prisma.js'
import { createCallbackSignature } from '../../src/middlewares/paymentCallback.js'
import { adjustInventory, createProduct } from '../../src/services/adminCatalogService.js'
import {
	createAfterSale,
	createRefund,
	mockRefund,
	processRefundCallback,
	retryRefund,
	reviewAfterSale,
} from '../../src/services/afterSaleService.js'
import { purgeExpiredData } from '../../src/services/dataRetentionService.js'
import { createOrder } from '../../src/services/orderService.js'
import { mockPay } from '../../src/services/paymentService.js'

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

async function createActiveProduct(operatorId, stock = 1) {
	const category = await prisma.category.create({ data: { name: '测试分类', slug: `category-${Date.now()}` } })
	const product = await createProduct(
		{
			categoryId: category.id,
			name: '并发测试商品',
			slug: `product-${Date.now()}`,
			images: [],
			skus: [
				{
					skuCode: `SKU-${Date.now()}`,
					name: '默认规格',
					specifications: { color: 'black' },
					price: 9900,
					stock,
				},
			],
		},
		operatorId
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
		const { userRole, adminRole } = await seedBase()
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
