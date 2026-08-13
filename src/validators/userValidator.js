import { z } from 'zod'

export const updateProfileSchema = z
	.object({
		nickname: z.string().trim().min(1).max(80).optional(),
		avatarUrl: z.url().max(500).nullable().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, { message: '没有可更新的资料' })

export const addressSchema = z.object({
	recipientName: z.string().trim().min(1).max(80),
	phone: z.string().trim().min(6).max(30),
	province: z.string().trim().min(1).max(80),
	city: z.string().trim().min(1).max(80),
	district: z.string().trim().min(1).max(80),
	detail: z.string().trim().min(1).max(255),
	postalCode: z.string().trim().max(20).nullable().optional(),
	isDefault: z.boolean().default(false),
})

export const addressIdSchema = z.object({ id: z.string().min(1).max(30) })
export const addressUpdateSchema = addressSchema.extend({ id: z.string().min(1).max(30) })
