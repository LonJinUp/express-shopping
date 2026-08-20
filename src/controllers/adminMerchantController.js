import * as service from '../services/merchantService.js'

export async function listApplications(req, res) {
	return res.success(await service.listApplications(req.query))
}

export async function reviewApplication(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.reviewApplication(id, input, req.user.id), '入驻申请已处理')
}
