import { Router } from 'express'
import { claimCoupon, listAvailableCoupons, listUserCoupons } from '../controllers/promotionController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { couponIdSchema, userCouponListSchema } from '../validators/promotionValidator.js'

export const promotionRouter = Router()
promotionRouter.get('/coupons', listAvailableCoupons)
promotionRouter.get('/user-coupons', authenticate, validate(userCouponListSchema, 'query'), listUserCoupons)
promotionRouter.post('/coupons/claim', authenticate, validate(couponIdSchema), claimCoupon)
