import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
	level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
	base: {
		service: 'express-shop',
		environment: env.NODE_ENV,
	},
})
