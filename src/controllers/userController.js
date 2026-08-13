import * as userService from '../services/userService.js'

export async function getProfile(req, res) {
	return res.success(await userService.getProfile(req.user.id))
}

export async function updateProfile(req, res) {
	return res.success(await userService.updateProfile(req.user.id, req.body), '资料已更新')
}

export async function listAddresses(req, res) {
	return res.success(await userService.listAddresses(req.user.id))
}

export async function createAddress(req, res) {
	return res.success(await userService.createAddress(req.user.id, req.body), '地址已创建', 201)
}

export async function updateAddress(req, res) {
	const { id, ...input } = req.body
	return res.success(await userService.updateAddress(req.user.id, id, input), '地址已更新')
}

export async function deleteAddress(req, res) {
	await userService.deleteAddress(req.user.id, req.body.id)
	return res.success(null, '地址已删除')
}
