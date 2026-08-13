import { randomBytes } from 'node:crypto'

export function createOrderNo(now = new Date()) {
	const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 17)
	return `${timestamp}${randomBytes(5).toString('hex').toUpperCase()}`
}
