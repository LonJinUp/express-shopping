import { z } from 'zod'

const id = z.string().min(1).max(30)

export const afterSaleIdSchema = z.object({ id })

export const createAfterSaleSchema = z.object({
	clientRequestId: z.string().min(8).max(64),
	orderId: id,
	type: z.enum(['REFUND_ONLY', 'RETURN_REFUND']),
	reason: z.string().trim().min(1).max(255),
	description: z.string().trim().max(1000).nullable().optional(),
	items: z
		.array(z.object({ orderItemId: id, quantity: z.number().int().min(1).max(999) }))
		.min(1)
		.max(100),
})

export const returnShipmentSchema = z.object({
	id,
	carrierCode: z.string().trim().min(1).max(50),
	carrierName: z.string().trim().min(1).max(80),
	trackingNumber: z.string().trim().min(1).max(100),
})

export const afterSaleReviewSchema = z.object({
	id,
	action: z.enum(['APPROVE', 'REJECT']),
	approvedAmount: z.number().int().min(0).optional(),
	remark: z.string().trim().min(1).max(500),
})

export const afterSaleListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	status: z
		.enum(['PENDING', 'APPROVED', 'WAITING_RETURN', 'RETURNED', 'REFUNDING', 'COMPLETED', 'REJECTED', 'CANCELLED'])
		.optional(),
})

export const refundSchema = z.object({ clientRequestId: z.string().min(8).max(64) })

export const channelRefundSchema = z.object({
	id,
	clientRequestId: z.string().min(8).max(64),
	channel: z
		.string()
		.trim()
		.min(1)
		.max(30)
		.regex(/^[a-zA-Z0-9_-]+$/),
})

export const refundCallbackSchema = z.object({
	channel: z
		.string()
		.trim()
		.min(1)
		.max(30)
		.regex(/^[a-zA-Z0-9_-]+$/),
	eventId: z.string().min(1).max(100),
	refundNo: z.string().min(1).max(32),
	transactionId: z.string().min(1).max(100),
	status: z.enum(['SUCCESS', 'FAILED']),
	amount: z.number().int().positive(),
})

export const callbackChannelSchema = z.object({
	channel: z
		.string()
		.trim()
		.min(1)
		.max(30)
		.regex(/^[a-zA-Z0-9_-]+$/),
})
export const afterSaleActionSchema = z.object({ id })
export const afterSaleMockRefundSchema = refundSchema.extend({ id })
