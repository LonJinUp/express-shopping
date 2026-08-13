import { z } from 'zod'

const password = z.string().min(8).max(72)

export const registerSchema = z
	.object({
		email: z.email().max(191).optional(),
		phone: z.string().trim().min(6).max(30).optional(),
		password,
		nickname: z.string().trim().min(1).max(80),
	})
	.refine((data) => data.email || data.phone, { message: '邮箱和手机号至少填写一项' })

export const loginSchema = z.object({
	identifier: z.string().trim().min(1).max(191),
	password,
})

export const refreshSchema = z.object({
	refreshToken: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
	identifier: z.string().trim().min(1).max(191),
})

export const resetPasswordSchema = z.object({
	token: z.string().min(32).max(200),
	password,
})
