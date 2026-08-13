import { checkDependencies } from '../services/healthService.js'
import { runtimeStatus } from '../services/runtimeService.js'
import { metricsText, registry } from '../services/metricsService.js'

export function health(req, res) {
	return res.success({ liveness: true, ...runtimeStatus() })
}

export async function ready(req, res) {
	const dependencies = await checkDependencies()
	return res.success(
		{
			...dependencies,
			uptime: Math.floor(process.uptime()),
		},
		dependencies.ok ? 'ready' : 'dependencies unavailable',
		dependencies.ok ? 200 : 503
	)
}

export async function metrics(req, res) {
	res.setHeader('content-type', registry.contentType)
	return res.send(await metricsText())
}
