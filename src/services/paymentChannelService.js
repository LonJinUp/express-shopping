const channels = new Map()

export function registerPaymentChannel(channel, adapter) {
	if (!adapter || typeof adapter.queryPayment !== 'function') {
		throw new TypeError('payment channel adapter must implement queryPayment')
	}
	channels.set(channel.toUpperCase(), adapter)
}

export function unregisterPaymentChannel(channel) {
	channels.delete(channel.toUpperCase())
}

export function getPaymentChannel(channel) {
	return channels.get(channel.toUpperCase()) ?? null
}

export function normalizePaymentQueryResult(result) {
	if (!result || !['PENDING', 'SUCCESS', 'FAILED', 'NOT_FOUND'].includes(result.status)) {
		throw new TypeError('invalid payment query result')
	}
	if (result.status === 'SUCCESS' && !result.transactionId) {
		throw new TypeError('successful payment query result requires transactionId')
	}
	return {
		status: result.status,
		transactionId: result.transactionId ?? null,
		message: result.message ? String(result.message).slice(0, 500) : null,
	}
}
