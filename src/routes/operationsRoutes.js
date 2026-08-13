import { Router } from 'express'
import {
	addFavorite,
	buyAgain,
	clearHistory,
	getHome,
	listFavorites,
	listHistory,
	recordHistory,
	removeFavorite,
} from '../controllers/operationsController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { orderActionParamsSchema, productActionParamsSchema } from '../validators/operationsValidator.js'

export const operationsRouter = Router()
operationsRouter.get('/home', getHome)
operationsRouter.get('/favorites', authenticate, listFavorites)
operationsRouter.post('/products/favorite', authenticate, validate(productActionParamsSchema), addFavorite)
operationsRouter.post('/products/unfavorite', authenticate, validate(productActionParamsSchema), removeFavorite)
operationsRouter.get('/browsing-history', authenticate, listHistory)
operationsRouter.post('/products/view', authenticate, validate(productActionParamsSchema), recordHistory)
operationsRouter.post('/browsing-history/clear', authenticate, clearHistory)
operationsRouter.post('/orders/buy-again', authenticate, validate(orderActionParamsSchema), buyAgain)
