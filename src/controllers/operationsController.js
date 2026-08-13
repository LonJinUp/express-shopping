import * as engagementService from '../services/engagementService.js'
import * as homeService from '../services/homeService.js'

export async function getHome(req, res) {
	return res.success(await homeService.getHomeBlocks())
}
export async function listFavorites(req, res) {
	return res.success(await engagementService.listFavorites(req.user.id))
}
export async function addFavorite(req, res) {
	return res.success(await engagementService.addFavorite(req.user.id, req.body.id), '已收藏', 201)
}
export async function removeFavorite(req, res) {
	await engagementService.removeFavorite(req.user.id, req.body.id)
	return res.success(null, '已取消收藏')
}
export async function listHistory(req, res) {
	return res.success(await engagementService.listHistory(req.user.id))
}
export async function recordHistory(req, res) {
	return res.success(await engagementService.recordHistory(req.user.id, req.body.id), '浏览记录已保存')
}
export async function clearHistory(req, res) {
	await engagementService.clearHistory(req.user.id)
	return res.success(null, '浏览记录已清空')
}
export async function buyAgain(req, res) {
	return res.success(await engagementService.buyAgain(req.user.id, req.body.id), '已加入购物车')
}
