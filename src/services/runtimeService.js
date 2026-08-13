import { recordTaskMetric } from './metricsService.js'

const startedAt = new Date()
const tasks = new Map()
let shuttingDown = false

export function markShuttingDown() {
	shuttingDown = true
}

export function recordTaskStarted(name) {
	const previous = tasks.get(name) ?? {}
	tasks.set(name, { ...previous, status: 'running', lastStartedAt: new Date(), lastError: null })
}

export function recordTaskCompleted(name, result) {
	const previous = tasks.get(name) ?? {}
	tasks.set(name, { ...previous, status: 'idle', lastCompletedAt: new Date(), lastResult: result, lastError: null })
	recordTaskMetric(name, 'success')
}

export function recordTaskFailed(name, error) {
	const previous = tasks.get(name) ?? {}
	tasks.set(name, {
		...previous,
		status: 'failed',
		lastFailedAt: new Date(),
		lastError: error instanceof Error ? error.message : String(error),
	})
	recordTaskMetric(name, 'failure')
}

export function runtimeStatus() {
	const publicTasks = Object.fromEntries(
		[...tasks].map(([name, task]) => {
			const { lastError, ...publicTask } = task
			return [name, { ...publicTask, failed: Boolean(lastError) }]
		})
	)
	return {
		status: shuttingDown ? 'shutting_down' : 'running',
		startedAt,
		uptime: Math.floor(process.uptime()),
		tasks: publicTasks,
	}
}

export function isShuttingDown() {
	return shuttingDown
}
