import * as service from '../services/promotionService.js'

export async function listAvailableCoupons(req, res) {
	return res.success(await service.listAvailableCoupons())
}
export async function listUserCoupons(req, res) {
	return res.success(await service.listUserCoupons(req.user.id, req.query.status))
}
export async function claimCoupon(req, res) {
	return res.success(await service.claimCoupon(req.user.id, req.body.id), '优惠券领取成功', 201)
}
