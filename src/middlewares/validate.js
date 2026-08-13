export function validate(schema, source = 'body') {
	return (req, res, next) => {
		const result = schema.safeParse(req[source])
		if (!result.success) return next(result.error)
		if (source === 'query') {
			Object.defineProperty(req, 'query', {
				configurable: true,
				enumerable: true,
				value: result.data,
			})
		} else {
			req[source] = result.data
		}
		return next()
	}
}
