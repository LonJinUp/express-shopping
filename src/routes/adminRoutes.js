import { Router } from 'express'
import { auditAdminAction } from '../middlewares/audit.js'
import { adminCatalogRouter } from './adminCatalogRoutes.js'
import { adminAfterSaleRouter } from './adminAfterSaleRoutes.js'
import { adminOperationsRouter } from './adminOperationsRoutes.js'
import { adminOrderRouter } from './adminOrderRoutes.js'
import { adminPromotionRouter } from './adminPromotionRoutes.js'
import { adminReviewRouter } from './adminReviewRoutes.js'

export const adminRouter = Router()
adminRouter.use(auditAdminAction)
adminRouter.use(adminAfterSaleRouter)
adminRouter.use(adminCatalogRouter)
adminRouter.use(adminOrderRouter)
adminRouter.use(adminReviewRouter)
adminRouter.use(adminPromotionRouter)
adminRouter.use(adminOperationsRouter)
