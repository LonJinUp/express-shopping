import * as service from '../services/orderService.js'
import { confirmReceipt as confirmReceiptService } from '../services/orderLifecycleService.js'

export async function directPreview(req, res) {
	return res.success(await service.directPreview(req.user.id, req.body))
}

export async function createOrder(req, res) {
	const result = await service.createOrder(req.user.id, req.body)
	return res.success(result.order, result.duplicated ? '订单已存在' : '订单创建成功', result.duplicated ? 200 : 201)
}

export async function listOrders(req, res) {
	return res.success(await service.listOrders(req.user.id, req.query))
}

export async function getOrder(req, res) {
	return res.success(await service.getOrder(req.user.id, req.query.id))
}

export async function cancelOrder(req, res) {
	return res.success(await service.cancelOrder(req.user.id, req.body.id, req.body.reason), '订单已取消')
}

export async function confirmReceipt(req, res) {
	return res.success(await confirmReceiptService(req.user.id, req.body.id), '已确认收货')
}
