import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export function notFound(req, res, next) {
	next(
		new AppError(`接口不存在: ${req.method} ${req.originalUrl}`, {
			statusCode: 404,
			code: ERROR_CODES.NOT_FOUND,
		})
	)
}
