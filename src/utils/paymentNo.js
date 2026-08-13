import { randomBytes } from 'node:crypto'

export function createPaymentNo(now = new Date()) {
	const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 17)
	return `P${timestamp}${randomBytes(5).toString('hex').toUpperCase()}`
}
