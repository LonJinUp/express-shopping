import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'

const dayMs = 24 * 60 * 60 * 1000

function before(now, days) {
	return new Date(now.getTime() - days * dayMs)
}

export async function purgeExpiredData(now = new Date(), settings = env) {
	const [sessions, passwordResetTokens, browsingHistory, paymentCallbacks, refundCallbacks, auditLogs] =
		await prisma.$transaction([
			prisma.userSession.deleteMany({
				where: {
					OR: [
						{ expiresAt: { lt: before(now, settings.SESSION_RETENTION_DAYS) } },
						{ revokedAt: { lt: before(now, settings.SESSION_RETENTION_DAYS) } },
					],
				},
			}),
			prisma.passwordResetToken.deleteMany({
				where: {
					OR: [
						{ expiresAt: { lt: before(now, settings.PASSWORD_RESET_RETENTION_DAYS) } },
						{ usedAt: { lt: before(now, settings.PASSWORD_RESET_RETENTION_DAYS) } },
					],
				},
			}),
			prisma.browsingHistory.deleteMany({
				where: { viewedAt: { lt: before(now, settings.BROWSING_HISTORY_RETENTION_DAYS) } },
			}),
			prisma.paymentCallbackLog.deleteMany({
				where: {
					status: { in: ['PROCESSED', 'REJECTED'] },
					createdAt: { lt: before(now, settings.CALLBACK_LOG_RETENTION_DAYS) },
				},
			}),
			prisma.refundCallbackLog.deleteMany({
				where: {
					status: { in: ['PROCESSED', 'REJECTED'] },
					createdAt: { lt: before(now, settings.CALLBACK_LOG_RETENTION_DAYS) },
				},
			}),
			prisma.auditLog.deleteMany({
				where: { createdAt: { lt: before(now, settings.AUDIT_LOG_RETENTION_DAYS) } },
			}),
		])

	return {
		sessions: sessions.count,
		passwordResetTokens: passwordResetTokens.count,
		browsingHistory: browsingHistory.count,
		paymentCallbacks: paymentCallbacks.count,
		refundCallbacks: refundCallbacks.count,
		auditLogs: auditLogs.count,
	}
}
