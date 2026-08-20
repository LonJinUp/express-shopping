const channels = new Map()

export function registerNotificationChannel(name, handler) {
	channels.set(name, handler)
}

export async function dispatchNotification(tx, outbox) {
	const handler = channels.get(outbox.channel)
	if (!handler) throw new Error(`未注册通知渠道：${outbox.channel}`)
	return handler(tx, outbox)
}

registerNotificationChannel('IN_APP', async (tx, outbox) => {
	const payload = outbox.payload
	return tx.userNotification.upsert({
		where: { userId_eventKey: { userId: outbox.userId, eventKey: outbox.eventKey } },
		update: {},
		create: {
			userId: outbox.userId,
			eventKey: outbox.eventKey,
			type: outbox.type,
			title: payload.title,
			content: payload.content,
			referenceType: payload.referenceType ?? null,
			referenceId: payload.referenceId ?? null,
		},
	})
})
