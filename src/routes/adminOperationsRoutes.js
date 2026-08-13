import { Router } from 'express'
import {
	createHomeBlock,
	dashboard,
	deleteHomeBlock,
	exportOrders,
	listHomeBlocks,
	updateHomeBlock,
} from '../controllers/adminOperationsController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { checkContentSafety } from '../middlewares/contentSafety.js'
import { validate } from '../middlewares/validate.js'
import {
	dashboardQuerySchema,
	exportOrderQuerySchema,
	homeBlockIdSchema,
	homeBlockInputSchema,
	homeBlockUpdateSchema,
} from '../validators/operationsValidator.js'

export const adminOperationsRouter = Router()
adminOperationsRouter.use(authenticate, authorize('ADMIN'))
adminOperationsRouter.get('/home-blocks', listHomeBlocks)
adminOperationsRouter.post('/home-blocks/create', checkContentSafety, validate(homeBlockInputSchema), createHomeBlock)
adminOperationsRouter.post('/home-blocks/update', checkContentSafety, validate(homeBlockUpdateSchema), updateHomeBlock)
adminOperationsRouter.post('/home-blocks/delete', validate(homeBlockIdSchema), deleteHomeBlock)
adminOperationsRouter.get('/analytics/dashboard', validate(dashboardQuerySchema, 'query'), dashboard)
adminOperationsRouter.get('/orders/export', validate(exportOrderQuerySchema, 'query'), exportOrders)
