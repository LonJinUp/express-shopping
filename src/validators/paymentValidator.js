import { z } from 'zod'

export const mockPaymentSchema = z.object({
	orderId: z.string().min(1).max(30),
	clientRequestId: z.string().min(8).max(64),
})

export const channelPaymentSchema = z.object({
	orderId: z.string().min(1).max(30),
	clientRequestId: z.string().min(8).max(64),
	channel: z
		.string()
		.trim()
		.min(1)
		.max(30)
		.regex(/^[a-zA-Z0-9_-]+$/),
})

export const paymentCallbackSchema = z.object({
	channel: z
		.string()
		.trim()
		.min(1)
		.max(30)
		.regex(/^[a-zA-Z0-9_-]+$/),
	eventId: z.string().min(1).max(100),
	paymentNo: z.string().min(1).max(32),
	transactionId: z.string().min(1).max(100),
	status: z.enum(['SUCCESS', 'FAILED']),
	amount: z.number().int().positive(),
})
