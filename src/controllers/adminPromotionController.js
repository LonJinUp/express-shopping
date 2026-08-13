import * as service from '../services/promotionService.js'

export async function createCoupon(req, res) {
	return res.success(await service.createCoupon(req.body), '优惠券已创建', 201)
}
export async function createShippingTemplate(req, res) {
	return res.success(await service.createShippingTemplate(req.body), '运费模板已创建', 201)
}
