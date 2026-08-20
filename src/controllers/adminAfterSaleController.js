import * as service from '../services/afterSaleService.js'

export async function listAfterSales(req, res) {
	return res.success(await service.listAdminAfterSales(req.query))
}
export async function getAfterSale(req, res) {
	return res.success(await service.getAdminAfterSale(req.query.id))
}
export async function reviewAfterSale(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.reviewAfterSale(id, input, req.user.id), '售后审核完成')
}
export async function confirmReturn(req, res) {
	return res.success(await service.confirmReturn(req.body.id, req.user.id), '已确认收到退货')
}
export async function mockRefund(req, res) {
	const result = await service.mockRefund(req.body.id, req.body.clientRequestId, req.user.id)
	return res.success(result.refund, result.duplicated ? '退款已处理' : '模拟退款成功')
}
export async function createRefund(req, res) {
	const { id, ...input } = req.body
	const result = await service.createRefund(id, input, req.user.id)
	return res.success(result.refund, result.duplicated ? '退款单已存在' : '退款单已创建')
}
export async function retryRefund(req, res) {
	return res.success(await service.retryRefund(req.body.id, req.user.id), '退款已重置为待处理')
}
export async function listArbitrations(req, res) {
	return res.success(await service.listArbitrations(req.query))
}
export async function resolveArbitration(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.resolveArbitration(id, input, req.user.id), '平台仲裁已完成')
}
