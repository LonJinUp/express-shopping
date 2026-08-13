import { z } from 'zod'

export const productListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	keyword: z.string().trim().max(100).optional(),
	categoryId: z.string().max(30).optional(),
	brandId: z.string().max(30).optional(),
	minPrice: z.coerce.number().int().min(0).optional(),
	maxPrice: z.coerce.number().int().min(0).optional(),
})

export const productIdSchema = z.object({ id: z.string().min(1).max(30) })
