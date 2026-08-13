import client from 'prom-client'

export const registry = new client.Registry()
registry.setDefaultLabels({ service: 'express-shop' })
client.collectDefaultMetrics({ register: registry, prefix: 'express_shop_' })

const httpRequests = new client.Counter({
	name: 'express_shop_http_requests_total',
	help: 'Total number of HTTP requests',
	labelNames: ['method', 'route', 'status_code'],
	registers: [registry],
})

const httpDuration = new client.Histogram({
	name: 'express_shop_http_request_duration_seconds',
	help: 'HTTP request duration in seconds',
	labelNames: ['method', 'route', 'status_code'],
	buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
	registers: [registry],
})

const taskRuns = new client.Counter({
	name: 'express_shop_task_runs_total',
	help: 'Total number of background task runs',
	labelNames: ['task', 'result'],
	registers: [registry],
})

const taskLastCompleted = new client.Gauge({
	name: 'express_shop_task_last_completed_timestamp_seconds',
	help: 'Unix timestamp of the last successful task completion',
	labelNames: ['task'],
	registers: [registry],
})

const dependencyUp = new client.Gauge({
	name: 'express_shop_dependency_up',
	help: 'Whether a required dependency is reachable',
	labelNames: ['dependency'],
	registers: [registry],
})

function routeLabel(req) {
	if (!req.route?.path) return 'unmatched'
	return `${req.baseUrl || ''}${req.route.path}` || '/'
}

export function observeHttpRequest(req, res, startedAt) {
	const labels = { method: req.method, route: routeLabel(req), status_code: String(res.statusCode) }
	const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9
	httpRequests.inc(labels)
	httpDuration.observe(labels, durationSeconds)
}

export function recordTaskMetric(task, result) {
	taskRuns.inc({ task, result })
	if (result === 'success') taskLastCompleted.set({ task }, Math.floor(Date.now() / 1000))
}

export function recordDependencyMetric(dependency, up) {
	dependencyUp.set({ dependency }, up ? 1 : 0)
}

export async function metricsText() {
	return registry.metrics()
}
