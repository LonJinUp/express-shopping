import * as financeService from '../services/merchantFinanceService.js'
import { prisma } from '../config/prisma.js'
import { ERROR_CODES } from '../constants/errorCodes.js'
import { AppError } from '../errors/AppError.js'

export async function listWithdrawals(req, res) {
	return res.success(await financeService.listWithdrawals({}, req.query))
}

export async function reviewWithdrawal(req, res) {
	return res.success(
		await financeService.reviewWithdrawal(req.body.id, req.body.action, req.body.remark, req.user.id),
		'提现状态已更新'
	)
}

export async function updateCommission(req, res) {
	const result = await prisma.shop.updateMany({
		where: { id: req.body.shopId },
		data: { commissionRateBps: req.body.commissionRateBps },
	})
	if (!result.count) throw new AppError('店铺不存在', { statusCode: 404, code: ERROR_CODES.NOT_FOUND })
	return res.success(await prisma.shop.findUnique({ where: { id: req.body.shopId } }), '店铺佣金比例已更新')
}
