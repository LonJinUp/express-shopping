import { Router } from 'express'
import { listApplications, reviewApplication } from '../controllers/adminMerchantController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { merchantApplicationListSchema, merchantApplicationReviewSchema } from '../validators/merchantValidator.js'

export const adminMerchantRouter = Router()
adminMerchantRouter.use(authenticate, authorize('ADMIN'))
adminMerchantRouter.get('/merchant-applications', validate(merchantApplicationListSchema, 'query'), listApplications)
adminMerchantRouter.post('/merchant-applications/review', validate(merchantApplicationReviewSchema), reviewApplication)
