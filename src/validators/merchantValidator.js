import { z } from 'zod'

const id = z.string().trim().min(1).max(30)
const code = z
	.string()
	.trim()
	.min(2)
	.max(50)
	.regex(/^[A-Z0-9_-]+$/)
const optionalUrl = z.string().trim().url().max(500).nullable().optional()

export const merchantApplicationInputSchema = z.object({
	clientRequestId: z.string().trim().min(8).max(64),
	merchantName: z.string().trim().min(2).max(120),
	merchantCode: code,
	shopName: z.string().trim().min(2).max(120),
	shopCode: code,
	contactName: z.string().trim().min(2).max(80),
	contactPhone: z.string().trim().min(6).max(30),
	qualificationUrl: optionalUrl,
})

export const merchantApplicationListSchema = z.object({
	status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export const merchantApplicationReviewSchema = z
	.object({
		id,
		action: z.enum(['APPROVE', 'REJECT']),
		reason: z.string().trim().min(2).max(500).optional(),
	})
	.superRefine((value, context) => {
		if (value.action === 'REJECT' && !value.reason) {
			context.addIssue({ code: 'custom', path: ['reason'], message: '驳回时必须填写原因' })
		}
	})

export const shopUpdateSchema = z
	.object({
		id,
		name: z.string().trim().min(2).max(120).optional(),
		description: z.string().trim().max(500).nullable().optional(),
		logoUrl: optionalUrl,
	})
	.refine((value) => Object.keys(value).some((key) => key !== 'id'), { message: '至少需要修改一个字段' })
