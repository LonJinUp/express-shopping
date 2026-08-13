import { describe, expect, it } from 'vitest'
import { csvCell } from '../src/services/analyticsService.js'

describe('CSV export safety', () => {
	it('neutralizes spreadsheet formulas', () => {
		expect(csvCell('=HYPERLINK("https://example.com")')).toBe('"\'=HYPERLINK(""https://example.com"")"')
		expect(csvCell('+SUM(1,1)')).toBe('"\'+SUM(1,1)"')
	})

	it('escapes quotes and empty values', () => {
		expect(csvCell('a"b')).toBe('"a""b"')
		expect(csvCell(null)).toBe('""')
	})
})
