import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import jsonwebtoken from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'
import {
	createSessionId,
	getTokenExpiresAt,
	hashToken,
	signAccessToken,
	signRefreshToken,
	verifyRefreshToken,
} from '../utils/tokens.js'

const { JsonWebTokenError, TokenExpiredError } = jsonwebtoken

const publicUserSelect = {
	id: true,
	email: true,
	phone: true,
	nickname: true,
	avatarUrl: true,
	status: true,
	createdAt: true,
}

function userRoles(user) {
	return user.roles.map(({ role }) => role.code)
}

function buildTokens(userId, sessionId, roles) {
	const accessToken = signAccessToken(userId, sessionId, roles)
	const refreshToken = signRefreshToken(userId, sessionId)
	return { accessToken, refreshToken, expiresIn: 900 }
}

export async function register(input) {
	const duplicate = await prisma.user.findFirst({
		where: {
			OR: [input.email ? { email: input.email } : undefined, input.phone ? { phone: input.phone } : undefined].filter(
				Boolean
			),
		},
		select: { id: true },
	})

	if (duplicate) {
		throw new AppError('邮箱或手机号已注册', { statusCode: 409, code: ERROR_CODES.CONFLICT })
	}

	const role = await prisma.role.findUnique({ where: { code: 'USER' }, select: { id: true } })
	if (!role) throw new AppError('系统角色尚未初始化')

	const passwordHash = await bcrypt.hash(input.password, 12)
	return prisma.user.create({
		data: {
			email: input.email,
			phone: input.phone,
			passwordHash,
			nickname: input.nickname,
			roles: { create: { roleId: role.id } },
		},
		select: publicUserSelect,
	})
}

export async function login(input, metadata = {}) {
	const user = await prisma.user.findFirst({
		where: {
			OR: [{ email: input.identifier }, { phone: input.identifier }],
		},
		include: { roles: { include: { role: true } } },
	})

	if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
		throw new AppError('账号或密码错误', { statusCode: 401, code: ERROR_CODES.INVALID_CREDENTIALS })
	}
	if (user.status !== 'ACTIVE') {
		throw new AppError('账号已被禁用', { statusCode: 403, code: ERROR_CODES.FORBIDDEN })
	}

	const sessionId = createSessionId()
	const roles = userRoles(user)
	const tokens = buildTokens(user.id, sessionId, roles)

	await prisma.userSession.create({
		data: {
			id: sessionId,
			userId: user.id,
			refreshTokenHash: hashToken(tokens.refreshToken),
			expiresAt: getTokenExpiresAt(tokens.refreshToken),
			userAgent: metadata.userAgent?.slice(0, 500),
			ip: metadata.ip?.replace(/^::ffff:/, '').slice(0, 80),
		},
	})

	return { user: pickPublicUser(user), roles, ...tokens }
}

export async function refresh(refreshToken) {
	try {
		const payload = verifyRefreshToken(refreshToken)
		if (payload.type !== 'refresh' || !payload.sub || !payload.sid) throw new JsonWebTokenError('invalid token')

		const session = await prisma.userSession.findFirst({
			where: {
				id: payload.sid,
				userId: payload.sub,
				refreshTokenHash: hashToken(refreshToken),
				revokedAt: null,
				expiresAt: { gt: new Date() },
			},
			include: { user: { include: { roles: { include: { role: true } } } } },
		})

		if (!session || session.user.status !== 'ACTIVE') {
			throw new AppError('刷新令牌已失效', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED })
		}

		const roles = userRoles(session.user)
		const tokens = buildTokens(session.userId, session.id, roles)
		const rotated = await prisma.userSession.updateMany({
			where: { id: session.id, refreshTokenHash: hashToken(refreshToken), revokedAt: null },
			data: {
				refreshTokenHash: hashToken(tokens.refreshToken),
				expiresAt: getTokenExpiresAt(tokens.refreshToken),
			},
		})
		if (!rotated.count) {
			throw new AppError('刷新令牌已被使用', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED })
		}

		return { roles, ...tokens }
	} catch (error) {
		if (error instanceof AppError) throw error
		if (error instanceof TokenExpiredError) {
			throw new AppError('刷新令牌已过期', { statusCode: 401, code: ERROR_CODES.TOKEN_EXPIRED })
		}
		if (error instanceof JsonWebTokenError) {
			throw new AppError('刷新令牌无效', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED })
		}
		throw error
	}
}

export async function logout(userId, sessionId) {
	await prisma.userSession.updateMany({
		where: { id: sessionId, userId, revokedAt: null },
		data: { revokedAt: new Date() },
	})
}

export async function requestPasswordReset(identifier) {
	const user = await prisma.user.findFirst({
		where: { OR: [{ email: identifier }, { phone: identifier }], status: 'ACTIVE' },
		select: { id: true },
	})

	if (!user) return null

	const token = randomBytes(32).toString('hex')
	const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000)
	await prisma.$transaction([
		prisma.passwordResetToken.updateMany({
			where: { userId: user.id, usedAt: null },
			data: { usedAt: new Date() },
		}),
		prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } }),
	])

	return token
}

export async function resetPassword(token, password) {
	const tokenHash = hashToken(token)
	const resetToken = await prisma.passwordResetToken.findFirst({
		where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' } },
		select: { id: true, userId: true },
	})
	if (!resetToken) {
		throw new AppError('重置令牌无效或已过期', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	}

	const passwordHash = await bcrypt.hash(password, 12)
	const usedAt = new Date()
	await prisma.$transaction(async (tx) => {
		const consumed = await tx.passwordResetToken.updateMany({
			where: { id: resetToken.id, usedAt: null, expiresAt: { gt: usedAt } },
			data: { usedAt },
		})
		if (!consumed.count) {
			throw new AppError('重置令牌已被使用', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		}
		await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } })
		await tx.userSession.updateMany({
			where: { userId: resetToken.userId, revokedAt: null },
			data: { revokedAt: usedAt },
		})
	})
}

function pickPublicUser(user) {
	return Object.fromEntries(Object.keys(publicUserSelect).map((key) => [key, user[key]]))
}
