import { z } from 'zod'

export const notificationOutboxListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'EXHAUSTED']).optional(),
	channel: z.string().trim().min(1).max(30).optional(),
	userId: z.string().min(1).max(30).optional(),
	eventKey: z.string().trim().min(1).max(120).optional(),
})

export const notificationOutboxIdSchema = z.object({ id: z.string().min(1).max(30) })
