import { z } from 'zod'

const id = z.string().min(1).max(30)

export const createOrderSchema = z.discriminatedUnion('source', [
	z.object({
		source: z.literal('CART'),
		clientRequestId: z.string().min(8).max(64),
		addressId: id,
		userCouponId: id.optional(),
		cartItemIds: z.array(id).min(1).max(200),
		buyerMessage: z.string().trim().max(255).optional(),
	}),
	z.object({
		source: z.literal('DIRECT'),
		clientRequestId: z.string().min(8).max(64),
		addressId: id,
		userCouponId: id.optional(),
		skuId: id,
		quantity: z.number().int().min(1).max(999),
		buyerMessage: z.string().trim().max(255).optional(),
	}),
])

export const directPreviewSchema = z.object({
	addressId: id,
	skuId: id,
	quantity: z.number().int().min(1).max(999),
	userCouponId: id.optional(),
})

export const orderIdSchema = z.object({ id })
export const cancelOrderSchema = z.object({ id, reason: z.string().trim().max(255).optional() })

export const orderListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	status: z
		.enum([
			'PENDING_PAYMENT',
			'PAID',
			'PROCESSING',
			'SHIPPED',
			'COMPLETED',
			'CANCELLED',
			'AFTER_SALE',
			'REFUNDING',
			'REFUNDED',
		])
		.optional(),
})
