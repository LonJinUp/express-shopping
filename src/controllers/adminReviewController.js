import * as service from '../services/reviewService.js'

export async function listReviews(req, res) {
	return res.success(await service.listReviews(req.query))
}

export async function moderateReview(req, res) {
	return res.success(await service.moderateReview(req.body.id, req.body.status), '评价审核完成')
}
