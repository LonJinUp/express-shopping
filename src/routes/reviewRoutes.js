import { Router } from 'express'
import { createReview, listProductReviews } from '../controllers/reviewController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { checkContentSafety } from '../middlewares/contentSafety.js'
import { createReviewSchema, productReviewParamsSchema, reviewListSchema } from '../validators/reviewValidator.js'

export const reviewRouter = Router()
reviewRouter.get(
	'/products/reviews',
	validate(productReviewParamsSchema.extend(reviewListSchema.shape), 'query'),
	listProductReviews
)
reviewRouter.post('/reviews/create', authenticate, checkContentSafety, validate(createReviewSchema), createReview)
