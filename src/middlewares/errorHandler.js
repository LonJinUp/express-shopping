import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import multer from 'multer'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ERROR_CODES } from '../constants/errorCodes.js'

export function errorHandler(error, req, res, next) {
	if (res.headersSent) return next(error)

	const isValidationError = error instanceof ZodError
	const isUniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
	const isUploadError = error instanceof multer.MulterError
	const statusCode = isValidationError
		? 422
		: isUniqueConflict
			? 409
			: isUploadError
				? error.code === 'LIMIT_FILE_SIZE'
					? 413
					: 422
				: (error.statusCode ?? 500)
	const code = isValidationError
		? ERROR_CODES.VALIDATION_ERROR
		: isUniqueConflict
			? ERROR_CODES.CONFLICT
			: isUploadError
				? ERROR_CODES.VALIDATION_ERROR
				: (error.code ?? ERROR_CODES.INTERNAL_ERROR)
	const expose = isValidationError || isUniqueConflict || isUploadError || error.expose || env.NODE_ENV !== 'production'

	if (statusCode >= 500) {
		logger.error({ err: error, requestId: req.id }, '请求处理失败')
	}

	return res.status(statusCode).json({
		code,
		message: isUniqueConflict
			? '数据已存在，请勿重复提交'
			: isUploadError
				? error.code === 'LIMIT_FILE_SIZE'
					? '上传文件超过大小限制'
					: '上传请求无效'
				: expose
					? error.message
					: '服务器内部错误',
		data: null,
		...(isValidationError ? { details: error.flatten() } : {}),
		requestId: req.id,
	})
}
