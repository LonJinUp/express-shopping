import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	getPaymentChannel,
	normalizePaymentQueryResult,
	registerPaymentChannel,
	unregisterPaymentChannel,
} from '../src/services/paymentChannelService.js'

describe('payment channel registry', () => {
	afterEach(() => unregisterPaymentChannel('TEST'))

	it('注册并按不区分大小写的渠道名取得适配器', () => {
		const adapter = { queryPayment: vi.fn() }
		registerPaymentChannel('test', adapter)

		expect(getPaymentChannel('TEST')).toBe(adapter)
	})

	it('拒绝缺少交易号的成功查询结果', () => {
		expect(() => normalizePaymentQueryResult({ status: 'SUCCESS' })).toThrow('requires transactionId')
	})

	it('标准化待处理查询结果并限制错误长度', () => {
		const result = normalizePaymentQueryResult({ status: 'PENDING', message: 'x'.repeat(600) })

		expect(result).toEqual({ status: 'PENDING', transactionId: null, message: 'x'.repeat(500) })
	})
})
