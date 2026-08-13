import { describe, expect, it } from 'vitest'
import { distributeDiscount } from '../src/services/pricingService.js'

describe('discount distribution', () => {
	it('preserves the exact discount after integer rounding', () => {
		const items = [
			{ skuId: 'a', goodsAmount: 100, discountAmount: 0, payableAmount: 100 },
			{ skuId: 'b', goodsAmount: 200, discountAmount: 0, payableAmount: 200 },
			{ skuId: 'c', goodsAmount: 300, discountAmount: 0, payableAmount: 300 },
		]
		distributeDiscount(items, new Set(['a', 'b', 'c']), 101)

		expect(items.reduce((total, item) => total + item.discountAmount, 0)).toBe(101)
		expect(items.reduce((total, item) => total + item.payableAmount, 0)).toBe(499)
	})

	it('only discounts eligible items', () => {
		const items = [
			{ skuId: 'a', goodsAmount: 100, discountAmount: 0, payableAmount: 100 },
			{ skuId: 'b', goodsAmount: 200, discountAmount: 0, payableAmount: 200 },
		]
		distributeDiscount(items, new Set(['b']), 50)

		expect(items[0]).toMatchObject({ discountAmount: 0, payableAmount: 100 })
		expect(items[1]).toMatchObject({ discountAmount: 50, payableAmount: 150 })
	})
})
