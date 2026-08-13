import * as analyticsService from '../services/analyticsService.js'
import * as homeService from '../services/homeService.js'

export async function listHomeBlocks(req, res) {
	return res.success(await homeService.listHomeBlocks())
}
export async function createHomeBlock(req, res) {
	return res.success(await homeService.createHomeBlock(req.body), '首页内容已创建', 201)
}
export async function updateHomeBlock(req, res) {
	const { id, ...input } = req.body
	return res.success(await homeService.updateHomeBlock(id, input), '首页内容已更新')
}
export async function deleteHomeBlock(req, res) {
	await homeService.deleteHomeBlock(req.body.id)
	return res.success(null, '首页内容已删除')
}
export async function dashboard(req, res) {
	return res.success(await analyticsService.dashboard(req.query))
}
export async function exportOrders(req, res) {
	const csv = await analyticsService.exportOrders(req.query)
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`)
	return res.status(200).send(csv)
}
