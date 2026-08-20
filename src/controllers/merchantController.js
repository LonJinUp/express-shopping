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

export async function listMembers(req, res) {
	return res.success(await service.listMembers(req.user.id, req.query.shopId))
}

export async function addMember(req, res) {
	const { shopId, ...input } = req.body
	return res.success(await service.addMember(req.user.id, shopId, input), '商户成员已添加', 201)
}

export async function updateMember(req, res) {
	const { shopId, userId, ...input } = req.body
	return res.success(await service.updateMember(req.user.id, shopId, userId, input), '商户成员已更新')
}

export async function listAuditLogs(req, res) {
	return res.success(await service.listMerchantAuditLogs(req.user.id, req.query.shopId, req.query))
}
