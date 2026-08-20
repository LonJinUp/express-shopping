import * as financeService from '../services/merchantFinanceService.js'
import { assertShopAccess } from '../services/merchantService.js'

async function merchantFor(userId, shopId, roles) {
	const shop = await assertShopAccess(userId, shopId, roles)
	return shop.merchantId
}

export async function getAccount(req, res) {
	const merchantId = await merchantFor(req.user.id, req.query.shopId)
	return res.success(await financeService.getAccount(merchantId))
}

export async function listLedger(req, res) {
	const merchantId = await merchantFor(req.user.id, req.query.shopId)
	return res.success(await financeService.listLedger(merchantId, req.query))
}

export async function createSettlement(req, res) {
	const merchantId = await merchantFor(req.user.id, req.body.shopId, ['OWNER', 'ADMIN'])
	const { shopId, ...input } = req.body
	const result = await financeService.createSettlement(merchantId, shopId, input)
	return res.success(
		result.settlement,
		result.duplicated ? '结算单已存在' : '结算单已生成',
		result.duplicated ? 200 : 201
	)
}

export async function listSettlements(req, res) {
	const merchantId = await merchantFor(req.user.id, req.query.shopId)
	return res.success(await financeService.listSettlements(merchantId, req.query))
}

export async function createWithdrawal(req, res) {
	const merchantId = await merchantFor(req.user.id, req.body.shopId, ['OWNER', 'ADMIN'])
	const result = await financeService.createWithdrawal(merchantId, req.user.id, req.body)
	return res.success(
		result.withdrawal,
		result.duplicated ? '提现申请已存在' : '提现申请已提交',
		result.duplicated ? 200 : 201
	)
}

export async function listWithdrawals(req, res) {
	const merchantId = await merchantFor(req.user.id, req.query.shopId)
	return res.success(await financeService.listWithdrawals({ merchantId }, req.query))
}
