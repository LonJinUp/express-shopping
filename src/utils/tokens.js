import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function createSessionId() {
	return randomBytes(12).toString('hex')
}

export function hashToken(token) {
	return createHash('sha256').update(token).digest('hex')
}

export function signAccessToken(userId, sessionId, roles) {
	return jwt.sign({ sid: sessionId, roles, type: 'access' }, env.JWT_ACCESS_SECRET, {
		subject: userId,
		expiresIn: env.JWT_ACCESS_EXPIRES_IN,
	})
}

export function signRefreshToken(userId, sessionId) {
	return jwt.sign({ sid: sessionId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
		subject: userId,
		jwtid: randomUUID(),
		expiresIn: env.JWT_REFRESH_EXPIRES_IN,
	})
}

export function verifyAccessToken(token) {
	return jwt.verify(token, env.JWT_ACCESS_SECRET)
}

export function verifyRefreshToken(token) {
	return jwt.verify(token, env.JWT_REFRESH_SECRET)
}

export function getTokenExpiresAt(token) {
	const payload = jwt.decode(token)
	return new Date(payload.exp * 1000)
}
