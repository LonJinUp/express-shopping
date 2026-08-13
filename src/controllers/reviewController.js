import * as service from '../services/reviewService.js'

export async function createReview(req, res) {
	return res.success(await service.createReview(req.user.id, req.body), '评价已提交，等待审核', 201)
}

export async function listProductReviews(req, res) {
	return res.success(await service.listProductReviews(req.query.productId, req.query))
}
