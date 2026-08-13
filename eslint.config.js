import js from '@eslint/js'
import globals from 'globals'

export default [
	{
		ignores: ['coverage/**', 'node_modules/**', 'prisma/migrations/**'],
	},
	js.configs.recommended,
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
			},
		},
		rules: {
			'no-console': 'off',
		},
	},
	{
		files: ['tests/**/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.vitest,
			},
		},
	},
]
