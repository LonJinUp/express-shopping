import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { createCallbackSignature } from '../src/middlewares/paymentCallback.js'

function callbackHeaders(body, timestamp = Math.floor(Date.now() / 1000)) {
	return {
		timestamp: String(timestamp),
		signature: createCallbackSignature(env.PAYMENT_CALLBACK_SECRET, timestamp, Buffer.from(JSON.stringify(body))),
	}
}

describe('API contract', () => {
	const app = createApp()

	it('rejects unsupported HTTP methods', async () => {
		const response = await request(app).put('/api/v1/profile').send({ nickname: 'test' }).expect(405)
		expect(response.body.code).toBe('METHOD_NOT_ALLOWED')
		expect(response.headers.allow).toBe('GET, POST, OPTIONS')
	})

	it('validates registration before accessing the database', async () => {
		const response = await request(app)
			.post('/api/v1/auth/register')
			.send({ nickname: 'test', password: 'short' })
			.expect(422)

		expect(response.body.code).toBe('VALIDATION_ERROR')
		expect(response.body.details).toBeDefined()
	})

	it('protects user endpoints', async () => {
		const response = await request(app).get('/api/v1/profile').expect(401)
		expect(response.body.code).toBe('UNAUTHORIZED')
	})

	it('protects admin endpoints', async () => {
		const response = await request(app).get('/api/v1/admin/products').expect(401)
		expect(response.body.code).toBe('UNAUTHORIZED')
	})

	it('protects order endpoints', async () => {
		const response = await request(app).post('/api/v1/orders/create').send({}).expect(401)
		expect(response.body.code).toBe('UNAUTHORIZED')
	})

	it('validates password reset input before accessing the database', async () => {
		const response = await request(app)
			.post('/api/v1/auth/reset-password')
			.send({ token: 'invalid', password: 'new-password' })
			.expect(422)
		expect(response.body.code).toBe('VALIDATION_ERROR')
	})

	it('rejects invalid payment callback signatures', async () => {
		const response = await request(app)
			.post('/api/v1/payments/callback')
			.set('x-payment-signature', 'invalid')
			.send({ channel: 'mock', eventId: 'event-1' })
			.expect(401)
		expect(response.body.code).toBe('UNAUTHORIZED')
	})

	it('rejects expired payment callback signatures', async () => {
		const body = { channel: 'mock', eventId: 'expired-event' }
		const headers = callbackHeaders(body, Math.floor(Date.now() / 1000) - env.PAYMENT_CALLBACK_TOLERANCE_SECONDS - 1)
		const response = await request(app)
			.post('/api/v1/payments/callback')
			.set('x-payment-timestamp', headers.timestamp)
			.set('x-payment-signature', headers.signature)
			.send(body)
			.expect(401)
		expect(response.body.code).toBe('UNAUTHORIZED')
	})

	it('validates signed payment callback payloads', async () => {
		const body = { channel: 'mock', eventId: 'event-1' }
		const headers = callbackHeaders(body)
		const response = await request(app)
			.post('/api/v1/payments/callback')
			.set('content-type', 'application/json')
			.set('x-payment-timestamp', headers.timestamp)
			.set('x-payment-signature', headers.signature)
			.send(body)
			.expect(422)
		expect(response.body.code).toBe('VALIDATION_ERROR')
	})

	it('validates signed refund callback payloads', async () => {
		const body = { channel: 'mock', eventId: 'refund-event-1' }
		const headers = callbackHeaders(body)
		const response = await request(app)
			.post('/api/v1/refunds/callback')
			.set('content-type', 'application/json')
			.set('x-payment-timestamp', headers.timestamp)
			.set('x-payment-signature', headers.signature)
			.send(body)
			.expect(422)
		expect(response.body.code).toBe('VALIDATION_ERROR')
	})

	it('requires resource identifiers in query instead of path parameters', async () => {
		const response = await request(app).get('/api/v1/products/detail').expect(422)
		expect(response.body.code).toBe('VALIDATION_ERROR')

		await request(app).get('/api/v1/products/example-id').expect(404)
	})

	it('sets baseline security headers', async () => {
		const response = await request(app).get('/health').expect(200)

		expect(response.headers['x-content-type-options']).toBe('nosniff')
		expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
		expect(response.headers['content-security-policy']).toBeTypeOf('string')
	})

	it('does not expose metrics when metrics are disabled', async () => {
		const response = await request(app).get('/metrics').expect(404)
		expect(response.body.code).toBe('NOT_FOUND')
	})
})
