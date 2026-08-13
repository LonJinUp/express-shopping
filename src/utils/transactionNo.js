import { randomBytes } from 'node:crypto'

function value(prefix, now = new Date()) {
	const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 17)
	return `${prefix}${timestamp}${randomBytes(5).toString('hex').toUpperCase()}`
}

export const createAfterSaleNo = () => value('A')
export const createRefundNo = () => value('R')
