import * as service from '../services/adminCatalogService.js'

export async function createCategory(req, res) {
	return res.success(await service.createCategory(req.body), '分类已创建', 201)
}

export async function updateCategory(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.updateCategory(id, input), '分类已更新')
}

export async function createBrand(req, res) {
	return res.success(await service.createBrand(req.body), '品牌已创建', 201)
}

export async function updateBrand(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.updateBrand(id, input), '品牌已更新')
}

export async function listProducts(req, res) {
	return res.success(await service.listProducts(req.query))
}

export async function getProduct(req, res) {
	return res.success(await service.getProduct(req.query.id))
}

export async function createProduct(req, res) {
	return res.success(await service.createProduct(req.body, req.user.id), '商品已创建', 201)
}

export async function updateProduct(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.updateProduct(id, input), '商品已更新')
}

export async function changeProductStatus(req, res) {
	return res.success(await service.changeProductStatus(req.body.id, req.body.status), '商品状态已更新')
}

export async function deleteProduct(req, res) {
	await service.deleteProduct(req.body.id)
	return res.success(null, '商品已删除')
}

export async function createSku(req, res) {
	const { productId, ...input } = req.body
	return res.success(await service.createSku(productId, input, req.user.id), 'SKU 已创建', 201)
}

export async function updateSku(req, res) {
	const { id, ...input } = req.body
	return res.success(await service.updateSku(id, input), 'SKU 已更新')
}

export async function adjustInventory(req, res) {
	return res.success(
		await service.adjustInventory(req.body.id, req.body.difference, req.body.remark, req.user.id),
		'库存已调整'
	)
}
