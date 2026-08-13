import { z } from 'zod'

const id = z.string().min(1).max(30)

export const couponIdSchema = z.object({ id })
export const userCouponListSchema = z.object({ status: z.enum(['AVAILABLE', 'USED', 'EXPIRED']).optional() })

export const couponInputSchema = z
	.object({
		code: z
			.string()
			.trim()
			.min(1)
			.max(50)
			.regex(/^[A-Z0-9_-]+$/),
		name: z.string().trim().min(1).max(120),
		scope: z.enum(['ALL', 'CATEGORY', 'PRODUCT']).default('ALL'),
		thresholdAmount: z.number().int().min(0).default(0),
		discountAmount: z.number().int().min(1),
		totalQuantity: z.number().int().min(1),
		perUserLimit: z.number().int().min(1).max(100).default(1),
		startsAt: z.coerce.date(),
		endsAt: z.coerce.date(),
		isActive: z.boolean().default(true),
		productIds: z.array(id).max(500).default([]),
		categoryIds: z.array(id).max(100).default([]),
	})
	.refine((value) => value.endsAt > value.startsAt, { message: '结束时间必须晚于开始时间' })
	.refine((value) => value.scope !== 'PRODUCT' || value.productIds.length > 0, { message: '指定商品券必须选择商品' })
	.refine((value) => value.scope !== 'CATEGORY' || value.categoryIds.length > 0, { message: '指定分类券必须选择分类' })

export const shippingTemplateInputSchema = z.object({
	name: z.string().trim().min(1).max(100),
	baseFee: z.number().int().min(0),
	freeThreshold: z.number().int().min(0).nullable().optional(),
	isDefault: z.boolean().default(false),
	isActive: z.boolean().default(true),
	regionRules: z
		.array(z.object({ province: z.string().trim().min(1).max(80), fee: z.number().int().min(0) }))
		.max(100)
		.default([]),
})
