import { Router } from 'express'
import {
	addItem,
	checkoutPreview,
	deleteItem,
	listCart,
	selectItems,
	updateItem,
} from '../controllers/cartController.js'
import { authenticate } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
	addCartItemSchema,
	cartItemIdSchema,
	checkoutPreviewSchema,
	selectCartItemsSchema,
	updateCartItemBodySchema,
} from '../validators/cartValidator.js'

export const cartRouter = Router()
cartRouter.get('/cart', authenticate, listCart)
cartRouter.post('/cart/items/add', authenticate, validate(addCartItemSchema), addItem)
cartRouter.post('/cart/items/update', authenticate, validate(updateCartItemBodySchema), updateItem)
cartRouter.post('/cart/items/delete', authenticate, validate(cartItemIdSchema), deleteItem)
cartRouter.post('/cart/items/select', authenticate, validate(selectCartItemsSchema), selectItems)
cartRouter.post('/checkout/preview', authenticate, validate(checkoutPreviewSchema), checkoutPreview)
