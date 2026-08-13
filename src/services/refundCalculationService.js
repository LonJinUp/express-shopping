import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export function calculateAfterSaleAmount(order, requestedItems, previousQuantityByItem = new Map()) {
	const orderItemMap = new Map(order.items.map((item) => [item.id, item]))
	const items = requestedItems.map((requested) => {
		const item = orderItemMap.get(requested.orderItemId)
		if (!item) throw new AppError('售后商品不属于该订单', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		if (requested.quantity > item.quantity)
			throw new AppError('售后数量超过购买数量', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
		const refundAmount = Math.floor((item.payableAmount * requested.quantity) / item.quantity)
		return { orderItemId: item.id, quantity: requested.quantity, refundAmount, orderItem: item }
	})
	const duplicateIds = new Set(requestedItems.map((item) => item.orderItemId))
	if (duplicateIds.size !== requestedItems.length)
		throw new AppError('售后商品不能重复', { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR })
	const requestedQuantityByItem = new Map(items.map((item) => [item.orderItemId, item.quantity]))
	const allItemsAndQuantity = order.items.every(
		(item) => (previousQuantityByItem.get(item.id) ?? 0) + (requestedQuantityByItem.get(item.id) ?? 0) === item.quantity
	)
	const itemAmount = items.reduce((total, item) => total + item.refundAmount, 0)
	const requestedAmount = itemAmount + (allItemsAndQuantity ? order.shippingAmount : 0)
	return { items, requestedAmount, allItemsAndQuantity }
}
