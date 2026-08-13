import { Router } from 'express'
import { listReviews, moderateReview } from '../controllers/adminReviewController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { reviewListSchema, reviewModerateSchema } from '../validators/reviewValidator.js'

export const adminReviewRouter = Router()
adminReviewRouter.use(authenticate, authorize('ADMIN'))
adminReviewRouter.get('/reviews', validate(reviewListSchema, 'query'), listReviews)
adminReviewRouter.post('/reviews/moderate', validate(reviewModerateSchema), moderateReview)
