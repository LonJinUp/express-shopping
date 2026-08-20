import {
	adminProductListSchema,
	entityIdSchema,
	inventoryAdjustSchema,
	productCreateSchema,
	productStatusBodySchema,
	productUpdateBodySchema,
	skuCreateBodySchema,
	skuUpdateBodySchema,
} from './adminCatalogValidator.js'
import { adminOrderIdSchema, adminOrderListSchema, orderNoteSchema, shipmentSchema } from './adminOrderValidator.js'
import {
	afterSaleActionSchema,
	afterSaleIdSchema,
	afterSaleListSchema,
	afterSaleMockRefundSchema,
	afterSaleReviewSchema,
	channelRefundSchema,
} from './afterSaleValidator.js'
import { dashboardQuerySchema, exportOrderQuerySchema } from './operationsValidator.js'
import { couponInputSchema, shippingTemplateInputSchema } from './promotionValidator.js'
import { z } from 'zod'

const shopScope = z.object({ shopId: z.string().min(1).max(30) })
export const merchantShopScopeSchema = shopScope

export const merchantProductListSchema = adminProductListSchema.and(shopScope)
export const merchantEntitySchema = entityIdSchema.and(shopScope)
export const merchantProductCreateSchema = productCreateSchema.and(shopScope)
export const merchantProductUpdateSchema = productUpdateBodySchema.and(shopScope)
export const merchantProductStatusSchema = productStatusBodySchema.and(shopScope)
export const merchantSkuCreateSchema = skuCreateBodySchema.and(shopScope)
export const merchantSkuUpdateSchema = skuUpdateBodySchema.and(shopScope)
export const merchantInventoryAdjustSchema = inventoryAdjustSchema.and(shopScope)
export const merchantOrderListSchema = adminOrderListSchema.and(shopScope)
export const merchantOrderIdSchema = adminOrderIdSchema.and(shopScope)
export const merchantShipmentSchema = shipmentSchema.and(shopScope)
export const merchantOrderNoteSchema = orderNoteSchema.and(shopScope)
export const merchantCouponListSchema = z
	.object({
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(20),
		isActive: z
			.enum(['true', 'false'])
			.transform((value) => value === 'true')
			.optional(),
	})
	.and(shopScope)
export const merchantCouponInputSchema = couponInputSchema.and(shopScope)
export const merchantShippingTemplateInputSchema = shippingTemplateInputSchema.and(shopScope)
export const merchantAfterSaleListSchema = afterSaleListSchema.and(shopScope)
export const merchantAfterSaleIdSchema = afterSaleIdSchema.and(shopScope)
export const merchantAfterSaleReviewSchema = afterSaleReviewSchema.and(shopScope)
export const merchantAfterSaleActionSchema = afterSaleActionSchema.and(shopScope)
export const merchantChannelRefundSchema = channelRefundSchema.and(shopScope)
export const merchantAfterSaleMockRefundSchema = afterSaleMockRefundSchema.and(shopScope)
export const merchantDashboardSchema = dashboardQuerySchema.and(shopScope)
export const merchantExportOrderSchema = exportOrderQuerySchema.and(shopScope)
