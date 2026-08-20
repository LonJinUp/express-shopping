import * as catalogService from '../services/adminCatalogService.js'
import * as orderService from '../services/adminOrderService.js'
import { assertShopAccess } from '../services/merchantService.js'
import * as lifecycleService from '../services/orderLifecycleService.js'
import * as promotionService from '../services/promotionService.js'
import * as afterSaleService from '../services/afterSaleService.js'
import * as analyticsService from '../services/analyticsService.js'

async function assertRead(req) {
	return assertShopAccess(req.user.id, req.method === 'GET' ? req.query.shopId : req.body.shopId)
}

async function assertManage(req) {
	return assertShopAccess(req.user.id, req.body.shopId, ['OWNER', 'ADMIN'])
}

export async function listProducts(req, res) {
	await assertRead(req)
	return res.success(await catalogService.listProducts(req.query, req.query.shopId))
}

export async function getProduct(req, res) {
	await assertRead(req)
	return res.success(await catalogService.getProduct(req.query.id, req.query.shopId))
}

export async function createProduct(req, res) {
	await assertManage(req)
	const { shopId, ...input } = req.body
	return res.success(await catalogService.createProduct(input, req.user.id, shopId), '商品已创建', 201)
}

export async function updateProduct(req, res) {
	await assertManage(req)
	const { id, shopId, ...input } = req.body
	return res.success(await catalogService.updateProduct(id, input, shopId), '商品已更新')
}

export async function changeProductStatus(req, res) {
	await assertManage(req)
	return res.success(
		await catalogService.changeProductStatus(req.body.id, req.body.status, req.body.shopId),
		'商品状态已更新'
	)
}

export async function deleteProduct(req, res) {
	await assertManage(req)
	await catalogService.deleteProduct(req.body.id, req.body.shopId)
	return res.success(null, '商品已删除')
}

export async function createSku(req, res) {
	await assertManage(req)
	const { productId, shopId, ...input } = req.body
	return res.success(await catalogService.createSku(productId, input, req.user.id, shopId), 'SKU 已创建', 201)
}

export async function updateSku(req, res) {
	await assertManage(req)
	const { id, shopId, ...input } = req.body
	return res.success(await catalogService.updateSku(id, input, shopId), 'SKU 已更新')
}

export async function adjustInventory(req, res) {
	await assertManage(req)
	return res.success(
		await catalogService.adjustInventory(
			req.body.id,
			req.body.difference,
			req.body.remark,
			req.user.id,
			req.body.shopId
		),
		'库存已调整'
	)
}

export async function listOrders(req, res) {
	await assertRead(req)
	return res.success(await orderService.listOrders(req.query, req.query.shopId))
}

export async function getOrder(req, res) {
	await assertRead(req)
	return res.success(await orderService.getOrder(req.query.id, req.query.shopId))
}

export async function acceptOrder(req, res) {
	await assertManage(req)
	return res.success(await lifecycleService.acceptOrder(req.body.id, req.user.id, req.body.shopId), '接单成功')
}

export async function shipOrder(req, res) {
	await assertManage(req)
	const { id, shopId, ...input } = req.body
	return res.success(await lifecycleService.shipOrder(id, input, req.user.id, shopId), '发货成功')
}

export async function addOrderNote(req, res) {
	await assertManage(req)
	return res.success(
		await orderService.addNote(req.body.id, req.user.id, req.body.content, req.body.shopId),
		'订单备注已添加',
		201
	)
}

export async function listCoupons(req, res) {
	await assertRead(req)
	return res.success(await promotionService.listManagedCoupons(req.query, req.query.shopId))
}

export async function createCoupon(req, res) {
	await assertManage(req)
	const { shopId, ...input } = req.body
	return res.success(await promotionService.createCoupon(input, shopId), '优惠券已创建', 201)
}

export async function listShippingTemplates(req, res) {
	await assertRead(req)
	return res.success(await promotionService.listShippingTemplates(req.query.shopId))
}

export async function createShippingTemplate(req, res) {
	await assertManage(req)
	const { shopId, ...input } = req.body
	return res.success(await promotionService.createShippingTemplate(input, shopId), '运费模板已创建', 201)
}

export async function listAfterSales(req, res) {
	await assertRead(req)
	return res.success(await afterSaleService.listAdminAfterSales(req.query, req.query.shopId))
}

export async function getAfterSale(req, res) {
	await assertRead(req)
	return res.success(await afterSaleService.getAdminAfterSale(req.query.id, req.query.shopId))
}

export async function reviewAfterSale(req, res) {
	await assertManage(req)
	const { id, shopId, ...input } = req.body
	return res.success(await afterSaleService.reviewAfterSale(id, input, req.user.id, shopId), '售后审核完成')
}

export async function confirmReturn(req, res) {
	await assertManage(req)
	return res.success(await afterSaleService.confirmReturn(req.body.id, req.user.id, req.body.shopId), '已确认收到退货')
}

export async function createRefund(req, res) {
	await assertManage(req)
	const { id, shopId, ...input } = req.body
	const result = await afterSaleService.createRefund(id, input, req.user.id, shopId)
	return res.success(result.refund, result.duplicated ? '退款单已存在' : '退款单已创建')
}

export async function retryRefund(req, res) {
	await assertManage(req)
	return res.success(
		await afterSaleService.retryRefund(req.body.id, req.user.id, req.body.shopId),
		'退款已重置为待处理'
	)
}

export async function mockRefund(req, res) {
	await assertManage(req)
	const result = await afterSaleService.mockRefund(req.body.id, req.body.clientRequestId, req.user.id, req.body.shopId)
	return res.success(result.refund, result.duplicated ? '退款已处理' : '模拟退款成功')
}

export async function dashboard(req, res) {
	await assertRead(req)
	return res.success(await analyticsService.dashboard(req.query, req.query.shopId))
}

export async function exportOrders(req, res) {
	await assertShopAccess(req.user.id, req.query.shopId, ['OWNER', 'ADMIN'])
	const csv = await analyticsService.exportOrders(req.query, req.query.shopId)
	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`)
	return res.status(200).send(csv)
}
