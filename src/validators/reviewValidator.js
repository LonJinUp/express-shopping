import { z } from 'zod'

const id = z.string().min(1).max(30)

export const reviewIdSchema = z.object({ id })

export const createReviewSchema = z.object({
	orderItemId: id,
	rating: z.number().int().min(1).max(5),
	content: z.string().trim().max(1000).nullable().optional(),
	isAnonymous: z.boolean().default(false),
	images: z.array(z.url().max(500)).max(9).default([]),
})

export const reviewListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
})

export const reviewModerateSchema = z.object({
	id,
	status: z.enum(['APPROVED', 'REJECTED']),
})

export const productReviewParamsSchema = z.object({ productId: id })
