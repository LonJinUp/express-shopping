import { Router } from 'express'
import {
	createAddress,
	deleteAddress,
	getProfile,
	listAddresses,
	updateAddress,
	updateProfile,
} from '../controllers/userController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
	addressIdSchema,
	addressSchema,
	addressUpdateSchema,
	updateProfileSchema,
} from '../validators/userValidator.js'

export const userRouter = Router()

userRouter.get('/profile', authenticate, getProfile)
userRouter.post('/profile/update', authenticate, validate(updateProfileSchema), updateProfile)
userRouter.get('/addresses', authenticate, listAddresses)
userRouter.post('/addresses/create', authenticate, validate(addressSchema), createAddress)
userRouter.post('/addresses/update', authenticate, validate(addressUpdateSchema), updateAddress)
userRouter.post('/addresses/delete', authenticate, validate(addressIdSchema), deleteAddress)
