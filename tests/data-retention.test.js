import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteMany = () => vi.fn().mockResolvedValue({ count: 0 })
const models = {
	userSession: { deleteMany: deleteMany() },
	passwordResetToken: { deleteMany: deleteMany() },
	browsingHistory: { deleteMany: deleteMany() },
	paymentCallbackLog: { deleteMany: deleteMany() },
	refundCallbackLog: { deleteMany: deleteMany() },
	auditLog: { deleteMany: deleteMany() },
}

vi.mock('../src/config/prisma.js', () => ({
	prisma: {
		...models,
		$transaction: vi.fn(async (operations) => Promise.all(operations)),
	},
}))

const { purgeExpiredData } = await import('../src/services/dataRetentionService.js')

describe('data retention', () => {
	beforeEach(() => {
		for (const model of Object.values(models)) model.deleteMany.mockClear()
	})

	it('uses an independent retention cutoff for each data category', async () => {
		const now = new Date('2026-08-13T00:00:00.000Z')
		await purgeExpiredData(now, {
			SESSION_RETENTION_DAYS: 90,
			PASSWORD_RESET_RETENTION_DAYS: 30,
			BROWSING_HISTORY_RETENTION_DAYS: 180,
			CALLBACK_LOG_RETENTION_DAYS: 365,
			AUDIT_LOG_RETENTION_DAYS: 730,
		})

		expect(models.userSession.deleteMany).toHaveBeenCalledWith({
			where: {
				OR: [
					{ expiresAt: { lt: new Date('2026-05-15T00:00:00.000Z') } },
					{ revokedAt: { lt: new Date('2026-05-15T00:00:00.000Z') } },
				],
			},
		})
		expect(models.passwordResetToken.deleteMany).toHaveBeenCalledWith({
			where: {
				OR: [
					{ expiresAt: { lt: new Date('2026-07-14T00:00:00.000Z') } },
					{ usedAt: { lt: new Date('2026-07-14T00:00:00.000Z') } },
				],
			},
		})
		expect(models.browsingHistory.deleteMany).toHaveBeenCalledWith({
			where: { viewedAt: { lt: new Date('2026-02-14T00:00:00.000Z') } },
		})
		expect(models.paymentCallbackLog.deleteMany).toHaveBeenCalledWith({
			where: {
				status: { in: ['PROCESSED', 'REJECTED'] },
				createdAt: { lt: new Date('2025-08-13T00:00:00.000Z') },
			},
		})
		expect(models.auditLog.deleteMany).toHaveBeenCalledWith({
			where: { createdAt: { lt: new Date('2024-08-13T00:00:00.000Z') } },
		})
	})
})
