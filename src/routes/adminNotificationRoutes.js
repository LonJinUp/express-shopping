import { Router } from 'express'
import { listNotificationOutbox, retryNotificationOutbox } from '../controllers/adminNotificationController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { notificationOutboxIdSchema, notificationOutboxListSchema } from '../validators/adminNotificationValidator.js'

export const adminNotificationRouter = Router()
adminNotificationRouter.use(authenticate, authorize('ADMIN'))
adminNotificationRouter.get(
	'/notification-outbox',
	validate(notificationOutboxListSchema, 'query'),
	listNotificationOutbox
)
adminNotificationRouter.post(
	'/notification-outbox/retry',
	validate(notificationOutboxIdSchema),
	retryNotificationOutbox
)
