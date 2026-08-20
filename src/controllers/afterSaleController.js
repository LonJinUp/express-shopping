import * as service from '../services/afterSaleService.js'

export async function createAfterSale(req, res) {
	const result = await service.createAfterSale(req.user.id, req.body)
	return res.success(
		result.afterSale,
		result.duplicated ? '售后申请已存在' : '售后申请已提交',
		result.duplicated ? 200 : 201
	)
}
export async function listAfterSales(req, res) {
	return res.success(await service.listAfterSales(req.user.id, req.query))
}
export async function getAfterSale(req, res) {
	return res.success(await service.getAfterSale(req.user.id, req.query.id))
}
export async function submitReturnShipment(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.submitReturnShipment(req.user.id, id, input), '退货物流已提交')
}
export async function requestArbitration(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.requestArbitration(req.user.id, id, input), '平台介入申请已提交', 201)
}
export async function refundCallback(req, res) {
	return res.success(
		await service.processRefundCallback(req.body.channel.toUpperCase(), req.body),
		'callback processed'
	)
}
