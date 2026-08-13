import jsonwebtoken from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import { verifyAccessToken } from '../utils/tokens.js'

const { JsonWebTokenError, TokenExpiredError } = jsonwebtoken

export async function authenticate(req, res, next) {
	const authorization = req.get('authorization')
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

	if (!token) {
		return next(new AppError('请先登录', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED }))
	}

	try {
		const payload = verifyAccessToken(token)
		if (payload.type !== 'access' || !payload.sub || !payload.sid) throw new JsonWebTokenError('invalid token')

		const session = await prisma.userSession.findFirst({
			where: {
				id: payload.sid,
				userId: payload.sub,
				revokedAt: null,
				expiresAt: { gt: new Date() },
				user: { status: 'ACTIVE' },
			},
			select: { id: true },
		})

		if (!session) {
			return next(new AppError('登录状态已失效', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED }))
		}

		req.user = { id: payload.sub, sessionId: payload.sid, roles: payload.roles ?? [] }
		return next()
	} catch (error) {
		if (error instanceof TokenExpiredError) {
			return next(new AppError('访问令牌已过期', { statusCode: 401, code: ERROR_CODES.TOKEN_EXPIRED }))
		}
		if (error instanceof JsonWebTokenError) {
			return next(new AppError('访问令牌无效', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED }))
		}
		return next(error)
	}
}

export function authorize(...allowedRoles) {
	return (req, res, next) => {
		if (!allowedRoles.some((role) => req.user?.roles.includes(role))) {
			return next(new AppError('没有权限执行此操作', { statusCode: 403, code: ERROR_CODES.FORBIDDEN }))
		}
		return next()
	}
}
