import { describe, expect, it } from 'vitest'
import { calculateAfterSaleAmount } from '../src/services/refundCalculationService.js'

const order = {
	shippingAmount: 800,
	items: [
		{ id: 'item-1', quantity: 2, payableAmount: 6000 },
		{ id: 'item-2', quantity: 1, payableAmount: 4000 },
	],
}

describe('calculateAfterSaleAmount', () => {
	it('按购买数量比例计算部分退款且不退运费', () => {
		const result = calculateAfterSaleAmount(order, [{ orderItemId: 'item-1', quantity: 1 }])

		expect(result.requestedAmount).toBe(3000)
		expect(result.allItemsAndQuantity).toBe(false)
	})

	it('一次退完全部商品时退还运费', () => {
		const result = calculateAfterSaleAmount(order, [
			{ orderItemId: 'item-1', quantity: 2 },
			{ orderItemId: 'item-2', quantity: 1 },
		])

		expect(result.requestedAmount).toBe(10_800)
		expect(result.allItemsAndQuantity).toBe(true)
	})

	it('分批退完最后一件商品时补退运费', () => {
		const previous = new Map([
			['item-1', 2],
			['item-2', 0],
		])
		const result = calculateAfterSaleAmount(order, [{ orderItemId: 'item-2', quantity: 1 }], previous)

		expect(result.requestedAmount).toBe(4800)
		expect(result.allItemsAndQuantity).toBe(true)
	})

	it('拒绝重复的订单商品', () => {
		expect(() =>
			calculateAfterSaleAmount(order, [
				{ orderItemId: 'item-1', quantity: 1 },
				{ orderItemId: 'item-1', quantity: 1 },
			])
		).toThrow('售后商品不能重复')
	})
})
