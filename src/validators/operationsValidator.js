import { z } from 'zod'

const id = z.string().min(1).max(30)

export const productActionParamsSchema = z.object({ id })
export const orderActionParamsSchema = z.object({ id })
export const homeBlockIdSchema = z.object({ id })

export const homeBlockInputSchema = z.object({
	type: z.enum(['BANNER', 'RECOMMENDATION', 'ANNOUNCEMENT']),
	title: z.string().trim().max(120).nullable().optional(),
	content: z.record(z.string(), z.unknown()),
	sortOrder: z.number().int().default(0),
	isActive: z.boolean().default(true),
	startsAt: z.coerce.date().nullable().optional(),
	endsAt: z.coerce.date().nullable().optional(),
})

export const homeBlockUpdateSchema = homeBlockInputSchema
	.and(z.object({ id }))
	.refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
		message: '结束时间必须晚于开始时间',
	})

export const dashboardQuerySchema = z.object({
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const exportOrderQuerySchema = z.object({
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']).optional(),
})
