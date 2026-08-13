import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('health endpoints', () => {
	const app = createApp()

	it('returns liveness information', async () => {
		const response = await request(app).get('/health').expect(200)

		expect(response.body.code).toBe('OK')
		expect(response.body.data.liveness).toBe(true)
		expect(response.body.data.status).toBe('running')
		expect(response.body.data.startedAt).toBeTypeOf('string')
		expect(response.body.data.tasks).toEqual({})
		expect(response.body.requestId).toBeTypeOf('string')
		expect(response.headers['x-request-id']).toBe(response.body.requestId)
	})

	it('returns API metadata', async () => {
		const response = await request(app).get('/api/v1').expect(200)

		expect(response.body.data).toEqual({ name: 'express-shop', version: 'v1' })
	})

	it('returns a stable not found error', async () => {
		const response = await request(app).get('/missing').expect(404)

		expect(response.body.code).toBe('NOT_FOUND')
		expect(response.body.data).toBeNull()
	})
})
