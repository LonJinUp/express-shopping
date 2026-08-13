import { timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { observeHttpRequest } from '../services/metricsService.js'

export function observeRequests(req, res, next) {
	const startedAt = process.hrtime.bigint()
	res.once('finish', () => observeHttpRequest(req, res, startedAt))
	next()
}

export function authorizeMetrics(req, res, next) {
	const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
	const expected = env.METRICS_TOKEN
	const valid =
		typeof token === 'string' &&
		typeof expected === 'string' &&
		token.length === expected.length &&
		timingSafeEqual(Buffer.from(token), Buffer.from(expected))
	if (!valid) return res.status(401).send('Unauthorized\n')
	return next()
}
