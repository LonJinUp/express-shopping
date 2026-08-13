import * as paymentService from '../services/paymentService.js'

export async function mockPay(req, res) {
	const result = await paymentService.mockPay(req.user.id, req.body)
	return res.success(result.payment, result.duplicated ? '支付已处理' : '模拟支付成功')
}

export async function createPayment(req, res) {
	const result = await paymentService.createPayment(req.user.id, req.body)
	return res.success(result.payment, result.duplicated ? '支付单已存在' : '支付单已创建')
}

export async function paymentCallback(req, res) {
	const result = await paymentService.processCallback(req.body.channel.toUpperCase(), req.body)
	return res.success(result, result.accepted ? 'callback accepted' : 'callback rejected')
}
