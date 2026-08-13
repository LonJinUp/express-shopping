import { performance } from 'node:perf_hooks'

const baseUrl = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3100'
const concurrency = Number.parseInt(process.env.PERF_CONCURRENCY ?? '25', 10)
const durationSeconds = Number.parseInt(process.env.PERF_DURATION_SECONDS ?? '10', 10)
const maxP95Ms = Number.parseInt(process.env.PERF_MAX_P95_MS ?? '500', 10)

function percentile(values, ratio) {
	return values[Math.min(values.length - 1, Math.floor(values.length * ratio))] ?? 0
}

async function main() {
	const firstPage = await fetch(`${baseUrl}/api/v1/products?page=1&pageSize=20`)
	if (!firstPage.ok) throw new Error(`商品列表预热失败: HTTP ${firstPage.status}`)
	const firstPageBody = await firstPage.json()
	const productId = firstPageBody.data.items[0]?.id
	if (!productId) throw new Error('性能测试数据中没有商品')
	const categoriesResponse = await fetch(`${baseUrl}/api/v1/categories`)
	if (!categoriesResponse.ok) throw new Error(`分类列表预热失败: HTTP ${categoriesResponse.status}`)
	const categoriesBody = await categoriesResponse.json()
	const categoryId = categoriesBody.data[0]?.id
	if (!categoryId) throw new Error('性能测试数据中没有分类')
	const paths = [
		'/api/v1/products?page=1&pageSize=20',
		'/api/v1/products?page=50&pageSize=20',
		'/api/v1/products?categoryId=' + encodeURIComponent(categoryId),
		'/api/v1/categories',
		`/api/v1/products/detail?id=${encodeURIComponent(productId)}`,
	]
	const latencies = []
	let requests = 0
	let errors = 0
	let cursor = 0
	const deadline = performance.now() + durationSeconds * 1000

	async function worker() {
		while (performance.now() < deadline) {
			const path = paths[cursor++ % paths.length]
			const startedAt = performance.now()
			try {
				const response = await fetch(baseUrl + path)
				await response.arrayBuffer()
				if (!response.ok) errors += 1
			} catch {
				errors += 1
			}
			latencies.push(performance.now() - startedAt)
			requests += 1
		}
	}

	const startedAt = performance.now()
	await Promise.all(Array.from({ length: concurrency }, () => worker()))
	const elapsedSeconds = (performance.now() - startedAt) / 1000
	latencies.sort((left, right) => left - right)
	const result = {
		requests,
		concurrency,
		durationSeconds: Number(elapsedSeconds.toFixed(2)),
		requestsPerSecond: Number((requests / elapsedSeconds).toFixed(2)),
		errorRate: Number((errors / requests).toFixed(6)),
		p50Ms: Number(percentile(latencies, 0.5).toFixed(2)),
		p95Ms: Number(percentile(latencies, 0.95).toFixed(2)),
		p99Ms: Number(percentile(latencies, 0.99).toFixed(2)),
	}
	console.log(JSON.stringify(result, null, 2))
	if (errors > 0 || result.p95Ms > maxP95Ms) process.exitCode = 1
}

await main()
