import { z } from 'zod'

export const notificationListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	unreadOnly: z
		.enum(['true', 'false'])
		.transform((value) => value === 'true')
		.default('false'),
})

export const notificationIdSchema = z.object({ id: z.string().min(1).max(30) })
