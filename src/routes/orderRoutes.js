import { Router } from 'express'
import {
	cancelOrder,
	confirmReceipt,
	createOrder,
	directPreview,
	getOrder,
	listOrders,
} from '../controllers/orderController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
	cancelOrderSchema,
	createOrderSchema,
	directPreviewSchema,
	orderIdSchema,
	orderListSchema,
} from '../validators/orderValidator.js'

export const orderRouter = Router()
orderRouter.post('/checkout/direct-preview', authenticate, validate(directPreviewSchema), directPreview)
orderRouter.post('/orders/create', authenticate, validate(createOrderSchema), createOrder)
orderRouter.get('/orders', authenticate, validate(orderListSchema, 'query'), listOrders)
orderRouter.get('/orders/detail', authenticate, validate(orderIdSchema, 'query'), getOrder)
orderRouter.post('/orders/cancel', authenticate, validate(cancelOrderSchema), cancelOrder)
orderRouter.post('/orders/confirm-receipt', authenticate, validate(orderIdSchema), confirmReceipt)
