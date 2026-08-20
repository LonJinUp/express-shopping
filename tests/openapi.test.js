import { describe, expect, it } from 'vitest'
import SwaggerParser from '@apidevtools/swagger-parser'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openapiDocument } from '../src/docs/openapi.js'

const routesDirectory = fileURLToPath(new URL('../src/routes', import.meta.url))

const requiredOperations = [
	['get', '/health'],
	['get', '/ready'],
	['get', '/api/v1'],
	['post', '/api/v1/auth/register'],
	['post', '/api/v1/auth/login'],
	['post', '/api/v1/auth/refresh'],
	['post', '/api/v1/auth/logout'],
	['post', '/api/v1/auth/forgot-password'],
	['post', '/api/v1/auth/reset-password'],
	['get', '/api/v1/profile'],
	['post', '/api/v1/profile/update'],
	['get', '/api/v1/addresses'],
	['post', '/api/v1/addresses/create'],
	['post', '/api/v1/addresses/update'],
	['post', '/api/v1/addresses/delete'],
	['get', '/api/v1/notifications'],
	['get', '/api/v1/notifications/unread-count'],
	['post', '/api/v1/notifications/read'],
	['post', '/api/v1/notifications/read-all'],
	['get', '/api/v1/categories'],
	['get', '/api/v1/brands'],
	['get', '/api/v1/products'],
	['get', '/api/v1/products/detail'],
	['get', '/api/v1/products/reviews'],
	['get', '/api/v1/cart'],
	['post', '/api/v1/cart/items/add'],
	['post', '/api/v1/cart/items/update'],
	['post', '/api/v1/cart/items/delete'],
	['post', '/api/v1/cart/items/select'],
	['post', '/api/v1/checkout/preview'],
	['post', '/api/v1/checkout/direct-preview'],
	['post', '/api/v1/orders/create'],
	['get', '/api/v1/orders'],
	['get', '/api/v1/orders/detail'],
	['get', '/api/v1/platform-orders'],
	['get', '/api/v1/platform-orders/detail'],
	['post', '/api/v1/orders/cancel'],
	['post', '/api/v1/orders/confirm-receipt'],
	['post', '/api/v1/orders/buy-again'],
	['post', '/api/v1/payments/create'],
	['post', '/api/v1/payments/mock-pay'],
	['post', '/api/v1/payments/callback'],
	['post', '/api/v1/refunds/callback'],
	['post', '/api/v1/reviews/create'],
	['get', '/api/v1/coupons'],
	['get', '/api/v1/user-coupons'],
	['post', '/api/v1/coupons/claim'],
	['get', '/api/v1/home'],
	['get', '/api/v1/favorites'],
	['post', '/api/v1/products/favorite'],
	['post', '/api/v1/products/unfavorite'],
	['post', '/api/v1/products/view'],
	['get', '/api/v1/browsing-history'],
	['post', '/api/v1/browsing-history/clear'],
	['post', '/api/v1/after-sales/create'],
	['get', '/api/v1/after-sales'],
	['get', '/api/v1/after-sales/detail'],
	['post', '/api/v1/after-sales/return-shipment'],
	['post', '/api/v1/after-sales/arbitration/request'],
	['post', '/api/v1/admin/categories/create'],
	['post', '/api/v1/admin/categories/update'],
	['post', '/api/v1/admin/brands/create'],
	['post', '/api/v1/admin/brands/update'],
	['get', '/api/v1/admin/products'],
	['get', '/api/v1/admin/products/detail'],
	['post', '/api/v1/admin/products/create'],
	['post', '/api/v1/admin/products/update'],
	['post', '/api/v1/admin/products/status'],
	['post', '/api/v1/admin/products/delete'],
	['post', '/api/v1/admin/skus/create'],
	['post', '/api/v1/admin/skus/update'],
	['post', '/api/v1/admin/skus/inventory/adjust'],
	['post', '/api/v1/admin/uploads/images'],
	['get', '/api/v1/admin/orders'],
	['get', '/api/v1/admin/orders/detail'],
	['post', '/api/v1/admin/orders/accept'],
	['post', '/api/v1/admin/orders/ship'],
	['post', '/api/v1/admin/orders/notes/create'],
	['get', '/api/v1/admin/orders/export'],
	['get', '/api/v1/admin/reviews'],
	['post', '/api/v1/admin/reviews/moderate'],
	['post', '/api/v1/admin/coupons/create'],
	['post', '/api/v1/admin/shipping-templates/create'],
	['get', '/api/v1/admin/home-blocks'],
	['post', '/api/v1/admin/home-blocks/create'],
	['post', '/api/v1/admin/home-blocks/update'],
	['post', '/api/v1/admin/home-blocks/delete'],
	['get', '/api/v1/admin/analytics/dashboard'],
	['get', '/api/v1/admin/analytics/platform-overview'],
	['get', '/api/v1/admin/after-sales'],
	['get', '/api/v1/admin/after-sales/detail'],
	['post', '/api/v1/admin/after-sales/review'],
	['post', '/api/v1/admin/after-sales/confirm-return'],
	['post', '/api/v1/admin/after-sales/refund'],
	['post', '/api/v1/admin/after-sales/retry-refund'],
	['post', '/api/v1/admin/after-sales/mock-refund'],
	['get', '/api/v1/admin/after-sales/arbitrations'],
	['post', '/api/v1/admin/after-sales/arbitrations/resolve'],
	['get', '/api/v1/merchant/finance/account'],
	['get', '/api/v1/merchant/members'],
	['post', '/api/v1/merchant/members/add'],
	['post', '/api/v1/merchant/members/update'],
	['get', '/api/v1/merchant/audit-logs'],
	['get', '/api/v1/merchant/finance/ledger'],
	['get', '/api/v1/merchant/finance/ledger/export'],
	['post', '/api/v1/merchant/finance/settlements/create'],
	['get', '/api/v1/merchant/finance/settlements'],
	['post', '/api/v1/merchant/finance/withdrawals/create'],
	['get', '/api/v1/merchant/finance/withdrawals'],
	['get', '/api/v1/admin/finance/withdrawals'],
	['post', '/api/v1/admin/finance/withdrawals/review'],
	['post', '/api/v1/admin/shops/commission/update'],
	['get', '/api/v1/admin/notification-outbox'],
	['post', '/api/v1/admin/notification-outbox/retry'],
]

describe('OpenAPI document', () => {
	it('documents every public API operation', () => {
		for (const [method, path] of requiredOperations) {
			expect(openapiDocument.paths[path]?.[method], `${method.toUpperCase()} ${path}`).toBeDefined()
		}
	})

	it('uses only GET and POST operations', () => {
		for (const pathItem of Object.values(openapiDocument.paths)) {
			const methods = Object.keys(pathItem)
			expect(methods.every((method) => ['get', 'post'].includes(method))).toBe(true)
		}
	})

	it('does not define URL path parameters', () => {
		for (const [path, pathItem] of Object.entries(openapiDocument.paths)) {
			expect(path, `dynamic path found: ${path}`).not.toMatch(/\{[^}]+\}/)

			for (const operation of Object.values(pathItem)) {
				expect(operation.parameters ?? []).not.toEqual(
					expect.arrayContaining([expect.objectContaining({ in: 'path' })])
				)
			}
		}
	})

	it('does not register dynamic Express routes', () => {
		for (const file of readdirSync(routesDirectory).filter((name) => name.endsWith('.js'))) {
			const source = readFileSync(`${routesDirectory}/${file}`, 'utf8')
			expect(source, `dynamic route found in ${file}`).not.toMatch(/\.(?:get|post)\(\s*['"][^'"]*:[A-Za-z]/)
			expect(source, `req.params found in ${file}`).not.toContain('req.params')
		}
	})

	it('defines referenced schemas and bearer authentication', () => {
		expect(openapiDocument.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' })
		expect(Object.keys(openapiDocument.components.schemas).length).toBeGreaterThan(25)
	})

	it('passes OpenAPI validation and resolves every reference', async () => {
		await expect(SwaggerParser.validate(structuredClone(openapiDocument))).resolves.toBeDefined()
	})
})
