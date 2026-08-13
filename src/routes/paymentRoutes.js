import { Router } from 'express'
import { createPayment, mockPay, paymentCallback } from '../controllers/paymentController.js'
import { authenticate } from '../middlewares/auth.js'
import { verifyPaymentCallback } from '../middlewares/paymentCallback.js'
import { validate } from '../middlewares/validate.js'
import { mockPaymentSchema, channelPaymentSchema, paymentCallbackSchema } from '../validators/paymentValidator.js'

export const paymentCallbackRouter = Router()

paymentCallbackRouter.post(
	'/payments/callback',
	verifyPaymentCallback,
	validate(paymentCallbackSchema),
	paymentCallback
)

export const paymentRouter = Router()
paymentRouter.post('/payments/create', authenticate, validate(channelPaymentSchema), createPayment)
paymentRouter.post('/payments/mock-pay', authenticate, validate(mockPaymentSchema), mockPay)
