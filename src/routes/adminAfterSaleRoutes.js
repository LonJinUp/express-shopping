import { Router } from 'express'
import {
	confirmReturn,
	createRefund,
	getAfterSale,
	listAfterSales,
	mockRefund,
	reviewAfterSale,
	retryRefund,
} from '../controllers/adminAfterSaleController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { checkContentSafety } from '../middlewares/contentSafety.js'
import { validate } from '../middlewares/validate.js'
import {
	afterSaleIdSchema,
	afterSaleListSchema,
	afterSaleReviewSchema,
	afterSaleActionSchema,
	afterSaleMockRefundSchema,
	channelRefundSchema,
} from '../validators/afterSaleValidator.js'

export const adminAfterSaleRouter = Router()
adminAfterSaleRouter.use(authenticate, authorize('ADMIN'))
adminAfterSaleRouter.get('/after-sales', validate(afterSaleListSchema, 'query'), listAfterSales)
adminAfterSaleRouter.get('/after-sales/detail', validate(afterSaleIdSchema, 'query'), getAfterSale)
adminAfterSaleRouter.post('/after-sales/review', checkContentSafety, validate(afterSaleReviewSchema), reviewAfterSale)
adminAfterSaleRouter.post('/after-sales/confirm-return', validate(afterSaleActionSchema), confirmReturn)
adminAfterSaleRouter.post('/after-sales/refund', validate(channelRefundSchema), createRefund)
adminAfterSaleRouter.post('/after-sales/retry-refund', validate(afterSaleActionSchema), retryRefund)
adminAfterSaleRouter.post('/after-sales/mock-refund', validate(afterSaleMockRefundSchema), mockRefund)
