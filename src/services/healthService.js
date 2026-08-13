import { prisma } from '../config/prisma.js'
import { redis } from '../config/redis.js'
import { isShuttingDown } from './runtimeService.js'
import { recordDependencyMetric } from './metricsService.js'

export async function checkDependencies() {
	const [database, cache] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()])
	recordDependencyMetric('mysql', database.status === 'fulfilled')
	recordDependencyMetric('redis', cache.status === 'fulfilled')

	return {
		ok: !isShuttingDown() && database.status === 'fulfilled' && cache.status === 'fulfilled',
		mysql: database.status === 'fulfilled' ? 'connected' : 'disconnected',
		redis: cache.status === 'fulfilled' ? 'connected' : 'disconnected',
	}
}
