import { z } from 'zod'

export const cartItemIdSchema = z.object({ id: z.string().min(1).max(30) })

export const addCartItemSchema = z.object({
	skuId: z.string().min(1).max(30),
	quantity: z.number().int().min(1).max(999),
})

export const updateCartItemSchema = z
	.object({
		quantity: z.number().int().min(1).max(999).optional(),
		selected: z.boolean().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, { message: '没有可更新的购物车信息' })

export const updateCartItemBodySchema = z
	.object({
		id: z.string().min(1).max(30),
		quantity: z.number().int().min(1).max(999).optional(),
		selected: z.boolean().optional(),
	})
	.refine((value) => value.quantity !== undefined || value.selected !== undefined, {
		message: '没有可更新的购物车信息',
	})

export const selectCartItemsSchema = z.object({
	itemIds: z.array(z.string().min(1).max(30)).max(200),
	selected: z.boolean(),
})

export const checkoutPreviewSchema = z.object({
	addressId: z.string().min(1).max(30),
	itemIds: z.array(z.string().min(1).max(30)).min(1).max(200).optional(),
	userCouponId: z.string().min(1).max(30).optional(),
	userCoupons: z
		.array(
			z.object({
				shopId: z.string().min(1).max(30),
				userCouponId: z.string().min(1).max(30),
			})
		)
		.max(100)
		.optional(),
})
