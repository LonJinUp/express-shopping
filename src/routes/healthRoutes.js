import { Router } from 'express'
import { health, metrics, ready } from '../controllers/healthController.js'
import { env } from '../config/env.js'
import { authorizeMetrics } from '../middlewares/metrics.js'

export const healthRouter = Router()

healthRouter.get('/health', health)
healthRouter.get('/ready', ready)
if (env.METRICS_ENABLED) healthRouter.get('/metrics', authorizeMetrics, metrics)
