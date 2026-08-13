import * as catalogService from '../services/catalogService.js'

export async function listCategories(req, res) {
	return res.success(await catalogService.listCategories())
}

export async function listBrands(req, res) {
	return res.success(await catalogService.listBrands())
}

export async function listProducts(req, res) {
	return res.success(await catalogService.listProducts(req.query))
}

export async function getProduct(req, res) {
	return res.success(await catalogService.getProduct(req.query.id))
}
