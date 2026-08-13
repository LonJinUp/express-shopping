import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import swaggerUi from 'swagger-ui-express'
import path from 'node:path'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { openapiDocument } from './docs/openapi.js'
import { enforceAllowedMethods } from './middlewares/allowedMethods.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { notFound } from './middlewares/notFound.js'
import { requestId } from './middlewares/requestId.js'
import { observeRequests } from './middlewares/metrics.js'
import { responseMiddleware } from './middlewares/response.js'
import { apiRateLimit } from './middlewares/rateLimit.js'
import { healthRouter } from './routes/healthRoutes.js'
import { apiRouter } from './routes/index.js'

export function createApp() {
	const app = express()

	if (env.TRUST_PROXY === '1') app.set('trust proxy', 1)

	app.disable('x-powered-by')
	app.use(requestId)
	app.use(observeRequests)
	app.use(enforceAllowedMethods)
	app.use(pinoHttp({ logger, genReqId: (req) => req.id }))
	app.use(helmet())
	app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()), credentials: true }))
	app.use(
		express.json({
			limit: '1mb',
			verify(req, res, buffer) {
				req.rawBody = Buffer.from(buffer)
			},
		})
	)
	app.use(express.urlencoded({ extended: false }))
	app.use(responseMiddleware)
	app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_LOCAL_DIR), { maxAge: '1d' }))

	app.use(healthRouter)
	app.use('/api/v1', apiRateLimit, apiRouter)

	if (env.SWAGGER_ENABLED) {
		app.get('/openapi.json', (req, res) => res.json(openapiDocument))
		app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument))
	}

	app.use(notFound)
	app.use(errorHandler)

	return app
}

export const app = createApp()
