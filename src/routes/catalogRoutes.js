import { Router } from 'express'
import { getProduct, listBrands, listCategories, listProducts } from '../controllers/catalogController.js'
import { validate } from '../middlewares/validate.js'
import { productIdSchema, productListSchema } from '../validators/catalogValidator.js'

export const catalogRouter = Router()

catalogRouter.get('/categories', listCategories)
catalogRouter.get('/brands', listBrands)
catalogRouter.get('/products', validate(productListSchema, 'query'), listProducts)
catalogRouter.get('/products/detail', validate(productIdSchema, 'query'), getProduct)
