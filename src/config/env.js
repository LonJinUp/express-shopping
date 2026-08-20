import 'dotenv/config'
import { z } from 'zod'

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().positive().max(65535).default(3000),
	TRUST_PROXY: z.enum(['0', '1']).default('0'),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	DATABASE_URL: z.string().url().default('mysql://express_shop:express_shop@127.0.0.1:3306/express_shop'),
	REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
	JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-change-me'),
	JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-change-me'),
	JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
	JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
	CORS_ORIGIN: z.string().default('http://localhost:5173'),
	SWAGGER_ENABLED: booleanString.default('true'),
	METRICS_ENABLED: booleanString.default('false'),
	METRICS_TOKEN: z.string().min(32).optional(),
	TASKS_ENABLED: booleanString.default('true'),
	SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(10_000),
	PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
	UPLOAD_LOCAL_DIR: z.string().default('uploads'),
	UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().max(20).default(5),
	PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().int().positive().max(60).default(15),
	ORDER_PAYMENT_EXPIRES_MINUTES: z.coerce.number().int().positive().max(120).default(30),
	ORDER_AUTO_RECEIVE_DAYS: z.coerce.number().int().positive().max(60).default(14),
	PAYMENT_QUERY_INTERVAL_SECONDS: z.coerce.number().int().positive().max(3600).default(60),
	PAYMENT_QUERY_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(100),
	PAYMENT_QUERY_MAX_ATTEMPTS: z.coerce.number().int().positive().max(100).default(10),
	NOTIFICATION_OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(100),
	NOTIFICATION_OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().max(20).default(5),
	NOTIFICATION_OUTBOX_RETRY_SECONDS: z.coerce.number().int().positive().max(3600).default(60),
	AFTER_SALE_REVIEW_HOURS: z.coerce.number().int().positive().max(168).default(24),
	AFTER_SALE_RETURN_DAYS: z.coerce.number().int().positive().max(30).default(7),
	AFTER_SALE_RECEIVE_HOURS: z.coerce.number().int().positive().max(168).default(48),
	AFTER_SALE_REFUND_HOURS: z.coerce.number().int().positive().max(168).default(24),
	PAYMENT_CALLBACK_SECRET: z.string().min(32).default('development-payment-callback-secret'),
	PAYMENT_CALLBACK_PREVIOUS_SECRET: z.string().min(32).optional(),
	PAYMENT_CALLBACK_TOLERANCE_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
	RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
	RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
	AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
	CONTENT_BLOCKED_WORDS: z.string().default(''),
	SESSION_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(90),
	PASSWORD_RESET_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(30),
	BROWSING_HISTORY_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(180),
	CALLBACK_LOG_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(365),
	AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(730),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
	console.error('环境变量校验失败', result.error.flatten().fieldErrors)
	process.exit(1)
}

if (
	result.data.NODE_ENV === 'production' &&
	(result.data.JWT_ACCESS_SECRET.startsWith('development-') ||
		result.data.JWT_REFRESH_SECRET.startsWith('development-') ||
		result.data.PAYMENT_CALLBACK_SECRET.startsWith('development-'))
) {
	console.error('生产环境必须配置安全的 JWT 密钥')
	process.exit(1)
}

if (result.data.NODE_ENV === 'production' && result.data.METRICS_ENABLED && !result.data.METRICS_TOKEN) {
	console.error('启用指标端点时必须配置至少 32 位的 METRICS_TOKEN')
	process.exit(1)
}

if (result.data.NODE_ENV !== 'production' && result.data.METRICS_ENABLED && !result.data.METRICS_TOKEN) {
	console.warn('未配置 METRICS_TOKEN，已在当前环境禁用指标端点')
	result.data.METRICS_ENABLED = false
}

export const env = result.data
