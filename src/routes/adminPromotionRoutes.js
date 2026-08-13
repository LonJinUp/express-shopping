import { Router } from 'express'
import { createCoupon, createShippingTemplate } from '../controllers/adminPromotionController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { couponInputSchema, shippingTemplateInputSchema } from '../validators/promotionValidator.js'

export const adminPromotionRouter = Router()
adminPromotionRouter.use(authenticate, authorize('ADMIN'))
adminPromotionRouter.post('/coupons/create', validate(couponInputSchema), createCoupon)
adminPromotionRouter.post('/shipping-templates/create', validate(shippingTemplateInputSchema), createShippingTemplate)
