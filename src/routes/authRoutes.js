import { Router } from 'express'
import { forgotPassword, login, logout, refresh, register, resetPassword } from '../controllers/authController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { authRateLimit } from '../middlewares/rateLimit.js'
import {
	forgotPasswordSchema,
	loginSchema,
	refreshSchema,
	registerSchema,
	resetPasswordSchema,
} from '../validators/authValidator.js'

export const authRouter = Router()

authRouter.post('/register', authRateLimit, validate(registerSchema), register)
authRouter.post('/login', authRateLimit, validate(loginSchema), login)
authRouter.post('/refresh', validate(refreshSchema), refresh)
authRouter.post('/logout', authenticate, logout)
authRouter.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword)
authRouter.post('/reset-password', validate(resetPasswordSchema), resetPassword)
