import { Router } from 'express'
import {
	adjustInventory,
	changeProductStatus,
	createBrand,
	createCategory,
	createProduct,
	createSku,
	deleteProduct,
	getProduct,
	listProducts,
	updateBrand,
	updateCategory,
	updateProduct,
	updateSku,
} from '../controllers/adminCatalogController.js'
import { uploadProductImage } from '../controllers/uploadController.js'
import { authenticate, authorize } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { uploadImage } from '../middlewares/upload.js'
import {
	adminProductListSchema,
	brandInputSchema,
	brandUpdateSchema,
	categoryInputSchema,
	categoryUpdateSchema,
	entityIdSchema,
	inventoryAdjustSchema,
	productCreateSchema,
	productStatusBodySchema,
	productUpdateBodySchema,
	skuCreateBodySchema,
	skuUpdateBodySchema,
} from '../validators/adminCatalogValidator.js'

export const adminCatalogRouter = Router()

adminCatalogRouter.use(authenticate, authorize('ADMIN'))

adminCatalogRouter.post('/uploads/images', uploadImage, uploadProductImage)

adminCatalogRouter.post('/categories/create', validate(categoryInputSchema), createCategory)
adminCatalogRouter.post('/categories/update', validate(categoryUpdateSchema), updateCategory)
adminCatalogRouter.post('/brands/create', validate(brandInputSchema), createBrand)
adminCatalogRouter.post('/brands/update', validate(brandUpdateSchema), updateBrand)

adminCatalogRouter.get('/products', validate(adminProductListSchema, 'query'), listProducts)
adminCatalogRouter.get('/products/detail', validate(entityIdSchema, 'query'), getProduct)
adminCatalogRouter.post('/products/create', validate(productCreateSchema), createProduct)
adminCatalogRouter.post('/products/update', validate(productUpdateBodySchema), updateProduct)
adminCatalogRouter.post('/products/status', validate(productStatusBodySchema), changeProductStatus)
adminCatalogRouter.post('/products/delete', validate(entityIdSchema), deleteProduct)

adminCatalogRouter.post('/skus/create', validate(skuCreateBodySchema), createSku)
adminCatalogRouter.post('/skus/update', validate(skuUpdateBodySchema), updateSku)
adminCatalogRouter.post('/skus/inventory/adjust', validate(inventoryAdjustSchema), adjustInventory)
