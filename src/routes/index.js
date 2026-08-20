import { Router } from 'express'
import { adminRouter } from './adminRoutes.js'
import { authRouter } from './authRoutes.js'
import { catalogRouter } from './catalogRoutes.js'
import { cartRouter } from './cartRoutes.js'
import { orderRouter } from './orderRoutes.js'
import { paymentCallbackRouter, paymentRouter } from './paymentRoutes.js'
import { reviewRouter } from './reviewRoutes.js'
import { promotionRouter } from './promotionRoutes.js'
import { operationsRouter } from './operationsRoutes.js'
import { userRouter } from './userRoutes.js'
import { afterSaleRouter, refundCallbackRouter } from './afterSaleRoutes.js'
import { merchantRouter } from './merchantRoutes.js'
import { merchantCommerceRouter } from './merchantCommerceRoutes.js'

export const apiRouter = Router()

apiRouter.get('/', (req, res) => {
	res.success({ name: 'express-shop', version: 'v1' })
})

apiRouter.use('/auth', authRouter)
apiRouter.use(catalogRouter)
apiRouter.use(cartRouter)
apiRouter.use(orderRouter)
apiRouter.use(paymentCallbackRouter)
apiRouter.use(refundCallbackRouter)
apiRouter.use(paymentRouter)
apiRouter.use(reviewRouter)
apiRouter.use(promotionRouter)
apiRouter.use(operationsRouter)
apiRouter.use(userRouter)
apiRouter.use(afterSaleRouter)
apiRouter.use(merchantRouter)
apiRouter.use('/merchant', merchantCommerceRouter)
apiRouter.use('/admin', adminRouter)
