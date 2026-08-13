import { Router } from 'express'
import { acceptOrder, addNote, getOrder, listOrders, shipOrder } from '../controllers/adminOrderController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { checkContentSafety } from '../middlewares/contentSafety.js'
import {
	adminOrderIdSchema,
	adminOrderListSchema,
	orderNoteSchema,
	shipmentSchema,
} from '../validators/adminOrderValidator.js'

export const adminOrderRouter = Router()
adminOrderRouter.use(authenticate, authorize('ADMIN'))
adminOrderRouter.get('/orders', validate(adminOrderListSchema, 'query'), listOrders)
adminOrderRouter.get('/orders/detail', validate(adminOrderIdSchema, 'query'), getOrder)
adminOrderRouter.post('/orders/accept', validate(adminOrderIdSchema), acceptOrder)
adminOrderRouter.post('/orders/ship', validate(shipmentSchema), shipOrder)
adminOrderRouter.post('/orders/notes/create', checkContentSafety, validate(orderNoteSchema), addNote)
