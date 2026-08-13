import { env } from '../config/env.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

const blockedWords = env.CONTENT_BLOCKED_WORDS.split(',')
	.map((word) => word.trim())
	.filter(Boolean)

function stringsIn(value) {
	if (typeof value === 'string') return [value]
	if (Array.isArray(value)) return value.flatMap(stringsIn)
	if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
	return []
}

export function checkContentSafety(req, res, next) {
	if (!blockedWords.length) return next()
	const matched = blockedWords.find((word) => stringsIn(req.body).some((text) => text.includes(word)))
	if (matched) {
		return next(new AppError('提交内容包含不允许的词语', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR }))
	}
	return next()
}
