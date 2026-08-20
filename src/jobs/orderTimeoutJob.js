import { logger } from '../config/logger.js'
import { runDataRetentionCleanup } from './dataRetentionJob.js'
import { autoReceiveOrders, closeExpiredOrders } from '../services/orderLifecycleService.js'
import { reconcilePendingPayments } from '../services/paymentService.js'
import { remindOverdueAfterSales } from '../services/afterSaleService.js'
import { recordTaskCompleted, recordTaskFailed, recordTaskStarted } from '../services/runtimeService.js'
import { processNotificationOutbox } from '../services/notificationService.js'

const intervalMs = 60_000
const taskName = 'commerce-timeout-scan'

export async function runCommerceTimeoutScan() {
	recordTaskStarted(taskName)
	try {
		const paymentReconciliation = await reconcilePendingPayments()
		const [closedCount, receivedCount, afterSaleReminderCount, dataRetention, notifications] = await Promise.all([
			closeExpiredOrders(),
			autoReceiveOrders(),
			remindOverdueAfterSales(),
			runDataRetentionCleanup(),
			processNotificationOutbox(),
		])
		const result = {
			closedCount,
			receivedCount,
			afterSaleReminderCount,
			paymentReconciliation,
			dataRetention,
			notifications,
		}
		recordTaskCompleted(taskName, result)
		if (
			closedCount > 0 ||
			receivedCount > 0 ||
			afterSaleReminderCount > 0 ||
			paymentReconciliation.queriedCount > 0 ||
			notifications.processedCount > 0 ||
			notifications.failedCount > 0
		) {
			logger.info(result, '超时巡检任务执行完成')
		}
		return result
	} catch (error) {
		recordTaskFailed(taskName, error)
		logger.error({ err: error }, '超时巡检任务失败')
		throw error
	}
}

export function startOrderTimeoutJob() {
	let running = false
	const timer = setInterval(async () => {
		if (running) {
			logger.warn('上一次超时巡检尚未完成，跳过本次执行')
			return
		}
		running = true
		try {
			await runCommerceTimeoutScan()
		} catch {
			// The scan records and logs its own failure state.
		} finally {
			running = false
		}
	}, intervalMs)
	timer.unref()
	return () => clearInterval(timer)
}
