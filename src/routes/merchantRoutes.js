import { Router } from 'express'
import { createApplication, listMyApplications, listMyShops, updateShop } from '../controllers/merchantController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { merchantApplicationInputSchema, shopUpdateSchema } from '../validators/merchantValidator.js'

export const merchantRouter = Router()
merchantRouter.post(
	'/merchant-applications/create',
	authenticate,
	validate(merchantApplicationInputSchema),
	createApplication
)
merchantRouter.get('/merchant-applications/mine', authenticate, listMyApplications)
merchantRouter.get('/merchant/shops', authenticate, listMyShops)
merchantRouter.post('/merchant/shops/update', authenticate, validate(shopUpdateSchema), updateShop)
