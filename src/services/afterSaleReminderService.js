import { env } from '../config/env.js'

const hourMs = 60 * 60 * 1000

export function buildAfterSaleOverdueWhere(now = new Date(), settings = env, unremindedOnly = false) {
	const before = (hours) => new Date(now.getTime() - hours * hourMs)
	return {
		...(unremindedOnly ? { remindedAt: null } : {}),
		OR: [
			{ status: 'PENDING', updatedAt: { lte: before(settings.AFTER_SALE_REVIEW_HOURS) } },
			{ status: 'WAITING_RETURN', updatedAt: { lte: before(settings.AFTER_SALE_RETURN_DAYS * 24) } },
			{ status: 'RETURNED', updatedAt: { lte: before(settings.AFTER_SALE_RECEIVE_HOURS) } },
			{ status: 'REFUNDING', updatedAt: { lte: before(settings.AFTER_SALE_REFUND_HOURS) } },
		],
	}
}
