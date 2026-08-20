import * as notificationService from '../services/notificationService.js'

export async function listNotificationOutbox(req, res) {
	return res.success(await notificationService.listNotificationOutbox(req.query))
}

export async function retryNotificationOutbox(req, res) {
	return res.success(await notificationService.retryNotificationOutbox(req.body.id), '通知任务已重新入队')
}
