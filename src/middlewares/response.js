export function responseMiddleware(req, res, next) {
	res.success = (data = null, message = 'success', statusCode = 200) => {
		return res.status(statusCode).json({
			code: 'OK',
			message,
			data,
			requestId: req.id,
		})
	}

	next()
}
