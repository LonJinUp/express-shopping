import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

function handler(req, res) {
	return res.status(429).json({
		code: 'TOO_MANY_REQUESTS',
		message: '请求过于频繁，请稍后重试',
		data: null,
		requestId: req.id,
	})
}

export const apiRateLimit = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	limit: env.RATE_LIMIT_MAX,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler,
})

export const authRateLimit = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	limit: env.AUTH_RATE_LIMIT_MAX,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler,
})
