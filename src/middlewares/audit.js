import { prisma } from '../config/prisma.js'
import { logger } from '../config/logger.js'

const sensitiveKeys = new Set(['password', 'refreshToken', 'token', 'secret'])

function sanitize(value) {
	if (Array.isArray(value)) return value.map(sanitize)
	if (!value || typeof value !== 'object') return value
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, sensitiveKeys.has(key) ? '[REDACTED]' : sanitize(item)])
	)
}

export function auditAdminAction(req, res, next) {
	if (req.method !== 'POST') return next()
	res.on('finish', () => {
		if (!req.user?.roles?.includes('ADMIN')) return
		prisma.auditLog
			.create({
				data: {
					operatorId: req.user.id,
					method: req.method,
					path: req.originalUrl.slice(0, 255),
					action: req.route?.path?.toString().slice(0, 100) ?? 'ADMIN_WRITE',
					targetId: req.body?.id ?? req.body?.productId ?? req.query?.id ?? req.query?.productId,
					requestId: req.id,
					ip: req.ip?.replace(/^::ffff:/, '').slice(0, 80),
					userAgent: req.get('user-agent')?.slice(0, 500),
					statusCode: res.statusCode,
					payload: sanitize(req.body),
				},
			})
			.catch((error) => logger.error({ err: error, requestId: req.id }, '管理操作审计写入失败'))
	})
	return next()
}
