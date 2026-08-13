import * as service from '../services/cartService.js'

export async function listCart(req, res) {
	return res.success(await service.listCart(req.user.id))
}
export async function addItem(req, res) {
	return res.success(await service.addItem(req.user.id, req.body), '已加入购物车', 201)
}
export async function updateItem(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.updateItem(req.user.id, id, input), '购物车已更新')
}
export async function deleteItem(req, res) {
	await service.deleteItem(req.user.id, req.body.id)
	return res.success(null, '购物车商品已删除')
}
export async function selectItems(req, res) {
	return res.success(await service.selectItems(req.user.id, req.body.itemIds, req.body.selected), '勾选状态已更新')
}
export async function checkoutPreview(req, res) {
	return res.success(await service.checkoutPreview(req.user.id, req.body))
}
