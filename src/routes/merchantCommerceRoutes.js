import { Router } from 'express'
import {
	acceptOrder,
	addOrderNote,
	adjustInventory,
	changeProductStatus,
	createProduct,
	createSku,
	deleteProduct,
	getOrder,
	getProduct,
	listOrders,
	listProducts,
	shipOrder,
	updateProduct,
	updateSku,
	listCoupons,
	createCoupon,
	listShippingTemplates,
	createShippingTemplate,
	listAfterSales,
	getAfterSale,
	reviewAfterSale,
	confirmReturn,
	createRefund,
	retryRefund,
	mockRefund,
	dashboard,
	exportOrders,
} from '../controllers/merchantCommerceController.js'
import { authenticate } from '../middlewares/auth.js'
import { checkContentSafety } from '../middlewares/contentSafety.js'
import { validate } from '../middlewares/validate.js'
import {
	merchantEntitySchema,
	merchantInventoryAdjustSchema,
	merchantOrderIdSchema,
	merchantOrderListSchema,
	merchantOrderNoteSchema,
	merchantProductCreateSchema,
	merchantProductListSchema,
	merchantProductStatusSchema,
	merchantProductUpdateSchema,
	merchantShipmentSchema,
	merchantSkuCreateSchema,
	merchantSkuUpdateSchema,
	merchantCouponListSchema,
	merchantCouponInputSchema,
	merchantShippingTemplateInputSchema,
	merchantAfterSaleListSchema,
	merchantAfterSaleIdSchema,
	merchantAfterSaleReviewSchema,
	merchantAfterSaleActionSchema,
	merchantChannelRefundSchema,
	merchantAfterSaleMockRefundSchema,
	merchantDashboardSchema,
	merchantExportOrderSchema,
	merchantShopScopeSchema,
} from '../validators/merchantCommerceValidator.js'

export const merchantCommerceRouter = Router()
merchantCommerceRouter.use(authenticate)

merchantCommerceRouter.get('/products', validate(merchantProductListSchema, 'query'), listProducts)
merchantCommerceRouter.get('/products/detail', validate(merchantEntitySchema, 'query'), getProduct)
merchantCommerceRouter.post('/products/create', validate(merchantProductCreateSchema), createProduct)
merchantCommerceRouter.post('/products/update', validate(merchantProductUpdateSchema), updateProduct)
merchantCommerceRouter.post('/products/status', validate(merchantProductStatusSchema), changeProductStatus)
merchantCommerceRouter.post('/products/delete', validate(merchantEntitySchema), deleteProduct)
merchantCommerceRouter.post('/skus/create', validate(merchantSkuCreateSchema), createSku)
merchantCommerceRouter.post('/skus/update', validate(merchantSkuUpdateSchema), updateSku)
merchantCommerceRouter.post('/skus/inventory/adjust', validate(merchantInventoryAdjustSchema), adjustInventory)

merchantCommerceRouter.get('/orders', validate(merchantOrderListSchema, 'query'), listOrders)
merchantCommerceRouter.get('/orders/detail', validate(merchantOrderIdSchema, 'query'), getOrder)
merchantCommerceRouter.post('/orders/accept', validate(merchantOrderIdSchema), acceptOrder)
merchantCommerceRouter.post('/orders/ship', validate(merchantShipmentSchema), shipOrder)
merchantCommerceRouter.post('/orders/notes/create', checkContentSafety, validate(merchantOrderNoteSchema), addOrderNote)

merchantCommerceRouter.get('/coupons', validate(merchantCouponListSchema, 'query'), listCoupons)
merchantCommerceRouter.post('/coupons/create', validate(merchantCouponInputSchema), createCoupon)
merchantCommerceRouter.get('/shipping-templates', validate(merchantShopScopeSchema, 'query'), listShippingTemplates)
merchantCommerceRouter.post(
	'/shipping-templates/create',
	validate(merchantShippingTemplateInputSchema),
	createShippingTemplate
)

merchantCommerceRouter.get('/after-sales', validate(merchantAfterSaleListSchema, 'query'), listAfterSales)
merchantCommerceRouter.get('/after-sales/detail', validate(merchantAfterSaleIdSchema, 'query'), getAfterSale)
merchantCommerceRouter.post(
	'/after-sales/review',
	checkContentSafety,
	validate(merchantAfterSaleReviewSchema),
	reviewAfterSale
)
merchantCommerceRouter.post('/after-sales/confirm-return', validate(merchantAfterSaleActionSchema), confirmReturn)
merchantCommerceRouter.post('/after-sales/refund', validate(merchantChannelRefundSchema), createRefund)
merchantCommerceRouter.post('/after-sales/retry-refund', validate(merchantAfterSaleActionSchema), retryRefund)
merchantCommerceRouter.post('/after-sales/mock-refund', validate(merchantAfterSaleMockRefundSchema), mockRefund)

merchantCommerceRouter.get('/analytics/dashboard', validate(merchantDashboardSchema, 'query'), dashboard)
merchantCommerceRouter.get('/orders/export', validate(merchantExportOrderSchema, 'query'), exportOrders)
