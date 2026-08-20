import { z } from 'zod'

const id = z.string().min(1).max(30)
const pagination = {
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
}
const withdrawalStatuses = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED']

export const financeShopScopeSchema = z.object({ shopId: id })

export const ledgerListSchema = z.object({
	shopId: id,
	...pagination,
	type: z
		.enum(['PAYMENT', 'REFUND', 'SETTLEMENT', 'WITHDRAWAL', 'WITHDRAWAL_RESTORE', 'WITHDRAWAL_COMPLETE'])
		.optional(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
})

export const ledgerExportSchema = z.object({
	shopId: id,
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
})

export const settlementCreateSchema = z
	.object({
		shopId: id,
		clientRequestId: z.string().min(8).max(64),
		periodStart: z.coerce.date(),
		periodEnd: z.coerce.date(),
	})
	.refine((value) => value.periodEnd >= value.periodStart, {
		path: ['periodEnd'],
		message: '结算结束时间不能早于开始时间',
	})

export const settlementListSchema = z.object({ shopId: id, ...pagination })

export const withdrawalCreateSchema = z.object({
	shopId: id,
	clientRequestId: z.string().min(8).max(64),
	amount: z.number().int().positive(),
	accountInfo: z.object({
		bankName: z.string().trim().min(2).max(100),
		accountName: z.string().trim().min(2).max(100),
		accountNo: z.string().trim().min(4).max(100),
	}),
})

export const merchantWithdrawalListSchema = z.object({
	shopId: id,
	...pagination,
	status: z.enum(withdrawalStatuses).optional(),
})

export const adminWithdrawalListSchema = z.object({
	...pagination,
	status: z.enum(withdrawalStatuses).optional(),
})

export const withdrawalReviewSchema = z.object({
	id,
	action: z.enum(['APPROVE', 'REJECT', 'COMPLETE']),
	remark: z.string().trim().min(2).max(500),
})

export const commissionUpdateSchema = z.object({
	shopId: id,
	commissionRateBps: z.number().int().min(0).max(10_000),
})
