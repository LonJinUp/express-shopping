import { describe, expect, it } from 'vitest'
import {
	recordTaskCompleted,
	recordTaskFailed,
	recordTaskStarted,
	runtimeStatus,
} from '../src/services/runtimeService.js'

describe('runtime status', () => {
	it('记录任务成功状态和结果', () => {
		recordTaskStarted('test-success')
		recordTaskCompleted('test-success', { count: 2 })

		expect(runtimeStatus().tasks['test-success']).toMatchObject({
			status: 'idle',
			lastResult: { count: 2 },
			failed: false,
		})
	})

	it('不向公开运行状态暴露异常原文', () => {
		recordTaskStarted('test-failure')
		recordTaskFailed('test-failure', new Error('secret database details'))
		const task = runtimeStatus().tasks['test-failure']

		expect(task.status).toBe('failed')
		expect(task.failed).toBe(true)
		expect(task.lastError).toBeUndefined()
		expect(JSON.stringify(task)).not.toContain('secret database details')
	})
})
