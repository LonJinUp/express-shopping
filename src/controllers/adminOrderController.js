import * as orderService from '../services/adminOrderService.js'
import * as lifecycleService from '../services/orderLifecycleService.js'

export async function listOrders(req, res) {
	return res.success(await orderService.listOrders(req.query))
}
export async function getOrder(req, res) {
	return res.success(await orderService.getOrder(req.query.id))
}
export async function acceptOrder(req, res) {
	return res.success(await lifecycleService.acceptOrder(req.body.id, req.user.id), '接单成功')
}
export async function shipOrder(req, res) {
	const { id, ...input } = req.body
	return res.success(await lifecycleService.shipOrder(id, input, req.user.id), '发货成功')
}

export async function addNote(req, res) {
	return res.success(await orderService.addNote(req.body.id, req.user.id, req.body.content), '订单备注已添加', 201)
}
