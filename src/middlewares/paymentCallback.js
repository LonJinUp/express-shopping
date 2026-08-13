import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export function createCallbackSignature(secret, timestamp, rawBody) {
	return createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex')
}

function signatureMatches(signature, timestamp, rawBody) {
	if (typeof signature !== 'string') return false
	return [env.PAYMENT_CALLBACK_SECRET, env.PAYMENT_CALLBACK_PREVIOUS_SECRET].filter(Boolean).some((secret) => {
		const expected = createCallbackSignature(secret, timestamp, rawBody)
		return (
			signature.length === expected.length &&
			timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))
		)
	})
}

export function verifyPaymentCallback(req, res, next) {
	const signature = req.get('x-payment-signature')
	const timestamp = req.get('x-payment-timestamp')
	const timestampSeconds = Number(timestamp)
	const timestampValid =
		Number.isSafeInteger(timestampSeconds) &&
		Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= env.PAYMENT_CALLBACK_TOLERANCE_SECONDS
	const valid = timestampValid && signatureMatches(signature, timestamp, req.rawBody ?? Buffer.alloc(0))

	if (!valid) {
		return next(new AppError('支付回调签名无效或已过期', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED }))
	}
	return next()
}
