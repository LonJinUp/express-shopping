import { Router } from 'express'
import {
	createAfterSale,
	getAfterSale,
	listAfterSales,
	refundCallback,
	submitReturnShipment,
} from '../controllers/afterSaleController.js'
import { authenticate } from '../middlewares/auth.js'
import { checkContentSafety } from '../middlewares/contentSafety.js'
import { verifyPaymentCallback } from '../middlewares/paymentCallback.js'
import { validate } from '../middlewares/validate.js'
import {
	afterSaleIdSchema,
	afterSaleListSchema,
	createAfterSaleSchema,
	refundCallbackSchema,
	returnShipmentSchema,
} from '../validators/afterSaleValidator.js'

export const refundCallbackRouter = Router()
refundCallbackRouter.post('/refunds/callback', verifyPaymentCallback, validate(refundCallbackSchema), refundCallback)

export const afterSaleRouter = Router()
afterSaleRouter.post(
	'/after-sales/create',
	authenticate,
	checkContentSafety,
	validate(createAfterSaleSchema),
	createAfterSale
)
afterSaleRouter.get('/after-sales', authenticate, validate(afterSaleListSchema, 'query'), listAfterSales)
afterSaleRouter.get('/after-sales/detail', authenticate, validate(afterSaleIdSchema, 'query'), getAfterSale)
afterSaleRouter.post('/after-sales/return-shipment', authenticate, validate(returnShipmentSchema), submitReturnShipment)
