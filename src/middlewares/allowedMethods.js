import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const allowedMethods = new Set(['GET', 'POST', 'OPTIONS'])

export function enforceAllowedMethods(req, res, next) {
	if (!allowedMethods.has(req.method)) {
		res.setHeader('Allow', 'GET, POST, OPTIONS')
		return next(
			new AppError('接口仅支持 GET 和 POST 请求', {
				statusCode: 405,
				code: ERROR_CODES.METHOD_NOT_ALLOWED,
			})
		)
	}
	return next()
}
