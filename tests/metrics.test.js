import { describe, expect, it } from 'vitest'
import { metricsText, recordDependencyMetric, recordTaskMetric } from '../src/services/metricsService.js'

describe('metrics', () => {
	it('输出任务和依赖指标', async () => {
		recordTaskMetric('test-metrics-task', 'success')
		recordDependencyMetric('test-dependency', true)
		const text = await metricsText()

		expect(text).toMatch(/express_shop_task_runs_total\{[^}]*task="test-metrics-task"[^}]*result="success"[^}]*} 1/)
		expect(text).toMatch(/express_shop_dependency_up\{[^}]*dependency="test-dependency"[^}]*} 1/)
	})
})
