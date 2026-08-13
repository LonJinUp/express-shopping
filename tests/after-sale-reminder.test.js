import { describe, expect, it } from 'vitest'
import { buildAfterSaleOverdueWhere } from '../src/services/afterSaleReminderService.js'

const settings = {
	AFTER_SALE_REVIEW_HOURS: 24,
	AFTER_SALE_RETURN_DAYS: 7,
	AFTER_SALE_RECEIVE_HOURS: 48,
	AFTER_SALE_REFUND_HOURS: 12,
}
const now = new Date('2026-08-12T12:00:00.000Z')

describe('buildAfterSaleOverdueWhere', () => {
	it('为各售后状态计算独立时限', () => {
		const where = buildAfterSaleOverdueWhere(now, settings)

		expect(where.OR).toEqual([
			{ status: 'PENDING', updatedAt: { lte: new Date('2026-08-11T12:00:00.000Z') } },
			{ status: 'WAITING_RETURN', updatedAt: { lte: new Date('2026-08-05T12:00:00.000Z') } },
			{ status: 'RETURNED', updatedAt: { lte: new Date('2026-08-10T12:00:00.000Z') } },
			{ status: 'REFUNDING', updatedAt: { lte: new Date('2026-08-12T00:00:00.000Z') } },
		])
		expect(where.remindedAt).toBeUndefined()
	})

	it('巡检任务只选择尚未提醒的售后单', () => {
		const where = buildAfterSaleOverdueWhere(now, settings, true)

		expect(where.remindedAt).toBeNull()
	})
})
