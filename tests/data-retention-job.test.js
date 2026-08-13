import { beforeEach, describe, expect, it, vi } from 'vitest'

const purgeExpiredData = vi.fn().mockResolvedValue({ sessions: 1 })
const recordTaskStarted = vi.fn()
const recordTaskCompleted = vi.fn()
const recordTaskFailed = vi.fn()

vi.mock('../src/services/dataRetentionService.js', () => ({ purgeExpiredData }))
vi.mock('../src/services/runtimeService.js', () => ({ recordTaskStarted, recordTaskCompleted, recordTaskFailed }))

const { resetDataRetentionSchedule, runDataRetentionCleanup } = await import('../src/jobs/dataRetentionJob.js')

describe('data retention job', () => {
	beforeEach(() => {
		resetDataRetentionSchedule()
		vi.clearAllMocks()
	})

	it('runs once per UTC date and runs again the next day', async () => {
		const first = await runDataRetentionCleanup(new Date('2026-08-13T01:00:00.000Z'))
		const duplicate = await runDataRetentionCleanup(new Date('2026-08-13T23:00:00.000Z'))
		const nextDay = await runDataRetentionCleanup(new Date('2026-08-14T00:01:00.000Z'))

		expect(first).toEqual({ sessions: 1 })
		expect(duplicate).toBeNull()
		expect(nextDay).toEqual({ sessions: 1 })
		expect(purgeExpiredData).toHaveBeenCalledTimes(2)
		expect(recordTaskStarted).toHaveBeenCalledTimes(2)
		expect(recordTaskCompleted).toHaveBeenCalledTimes(2)
		expect(recordTaskFailed).not.toHaveBeenCalled()
	})
})
