import { logger } from '../config/logger.js'
import { purgeExpiredData } from '../services/dataRetentionService.js'
import { recordTaskCompleted, recordTaskFailed, recordTaskStarted } from '../services/runtimeService.js'

const taskName = 'data-retention-cleanup'
let lastRunDate = null

export async function runDataRetentionCleanup(now = new Date()) {
	const runDate = now.toISOString().slice(0, 10)
	if (lastRunDate === runDate) return null

	recordTaskStarted(taskName)
	try {
		const result = await purgeExpiredData(now)
		lastRunDate = runDate
		recordTaskCompleted(taskName, result)
		logger.info(result, '数据保留清理任务执行完成')
		return result
	} catch (error) {
		recordTaskFailed(taskName, error)
		logger.error({ err: error }, '数据保留清理任务失败')
		throw error
	}
}

export function resetDataRetentionSchedule() {
	lastRunDate = null
}
