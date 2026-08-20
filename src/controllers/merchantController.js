import * as service from '../services/merchantService.js'

export async function createApplication(req, res) {
	const result = await service.createApplication(req.user.id, req.body)
	return res.success(result, result.duplicated ? '申请已提交' : '入驻申请已提交', result.duplicated ? 200 : 201)
}

export async function listMyApplications(req, res) {
	return res.success(await service.listMyApplications(req.user.id))
}

export async function listMyShops(req, res) {
	return res.success(await service.listMyShops(req.user.id))
}

export async function updateShop(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.updateShop(req.user.id, id, input), '店铺已更新')
}
