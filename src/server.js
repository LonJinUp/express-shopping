import { app } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma } from './config/prisma.js'
import { redis } from './config/redis.js'
import { ensureUploadDirectory } from './services/uploadService.js'
import { startOrderTimeoutJob } from './jobs/orderTimeoutJob.js'
import { markShuttingDown } from './services/runtimeService.js'

async function start() {
	await ensureUploadDirectory()
	await prisma.$connect()
	await redis.connect()

	const server = app.listen(env.PORT, () => {
		logger.info({ port: env.PORT }, `Server is running on http://localhost:${env.PORT}`)
	})
	const stopOrderTimeoutJob = env.TASKS_ENABLED ? startOrderTimeoutJob() : () => {}
	let shutdownStarted = false

	async function shutdown(signal) {
		if (shutdownStarted) return
		shutdownStarted = true
		markShuttingDown()
		logger.info({ signal }, '正在关闭服务')
		stopOrderTimeoutJob()
		server.closeIdleConnections?.()
		const forceTimer = setTimeout(() => {
			logger.error({ timeoutMs: env.SHUTDOWN_TIMEOUT_MS }, '优雅退出超时，强制终止')
			server.closeAllConnections?.()
			process.exit(1)
		}, env.SHUTDOWN_TIMEOUT_MS)
		forceTimer.unref()
		server.close(async () => {
			await Promise.allSettled([prisma.$disconnect(), redis.quit()])
			clearTimeout(forceTimer)
			process.exit(0)
		})
	}

	process.on('SIGTERM', () => shutdown('SIGTERM'))
	process.on('SIGINT', () => shutdown('SIGINT'))
	process.on('uncaughtException', (error) => {
		logger.fatal({ err: error }, '未捕获异常')
		shutdown('uncaughtException')
	})
	process.on('unhandledRejection', (error) => {
		logger.fatal({ err: error }, '未处理的 Promise 拒绝')
		shutdown('unhandledRejection')
	})
}

start().catch((error) => {
	logger.fatal({ err: error }, '服务启动失败')
	process.exit(1)
})
