import * as notificationService from '../services/notificationService.js'

export async function listNotifications(req, res) {
	return res.success(await notificationService.listNotifications(req.user.id, req.query))
}

export async function getUnreadCount(req, res) {
	return res.success(await notificationService.getUnreadCount(req.user.id))
}

export async function markNotificationRead(req, res) {
	return res.success(await notificationService.markNotificationRead(req.user.id, req.body.id), '通知已读')
}

export async function markAllNotificationsRead(req, res) {
	return res.success(await notificationService.markAllNotificationsRead(req.user.id), '通知已全部标记为已读')
}
