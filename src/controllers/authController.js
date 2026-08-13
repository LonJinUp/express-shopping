import * as authService from '../services/authService.js'
import { env } from '../config/env.js'

export async function register(req, res) {
	const user = await authService.register(req.body)
	return res.success(user, '注册成功', 201)
}

export async function login(req, res) {
	const result = await authService.login(req.body, { userAgent: req.get('user-agent'), ip: req.ip })
	return res.success(result, '登录成功')
}

export async function refresh(req, res) {
	const result = await authService.refresh(req.body.refreshToken)
	return res.success(result, '令牌刷新成功')
}

export async function logout(req, res) {
	await authService.logout(req.user.id, req.user.sessionId)
	return res.success(null, '已退出登录')
}

export async function forgotPassword(req, res) {
	const token = await authService.requestPasswordReset(req.body.identifier)
	return res.success(
		env.NODE_ENV === 'development' && token ? { resetToken: token } : null,
		'如果账号存在，密码重置指引已发送'
	)
}

export async function resetPassword(req, res) {
	await authService.resetPassword(req.body.token, req.body.password)
	return res.success(null, '密码已重置，请重新登录')
}
