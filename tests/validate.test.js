import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { validate } from '../src/middlewares/validate.js'

describe('validate middleware', () => {
	it('replaces the Express 5 query getter with parsed values', async () => {
		const app = express()
		app.get(
			'/query',
			validate(
				z.object({
					page: z.coerce.number().int().default(1),
					keyword: z.string().trim().optional(),
				}),
				'query'
			),
			(req, res) => res.json(req.query)
		)

		const response = await request(app).get('/query?page=2&keyword=%20phone%20').expect(200)
		expect(response.body).toEqual({ page: 2, keyword: 'phone' })
	})
})
