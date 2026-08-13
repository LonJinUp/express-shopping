import { z } from 'zod'

export const adminOrderIdSchema = z.object({ id: z.string().min(1).max(30) })

export const adminOrderListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']).optional(),
	orderNo: z.string().trim().max(32).optional(),
})

export const shipmentSchema = z.object({
	id: z.string().min(1).max(30),
	carrierCode: z.string().trim().min(1).max(50),
	carrierName: z.string().trim().min(1).max(80),
	trackingNumber: z.string().trim().min(1).max(100),
})

export const orderNoteSchema = z.object({
	id: z.string().min(1).max(30),
	content: z.string().trim().min(1).max(500),
})
