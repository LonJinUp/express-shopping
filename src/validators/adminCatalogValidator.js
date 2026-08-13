import { z } from 'zod'

const id = z.string().min(1).max(30)
const slug = z
	.string()
	.trim()
	.min(1)
	.max(191)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const entityIdSchema = z.object({ id })

export const categoryInputSchema = z.object({
	name: z.string().trim().min(1).max(100),
	slug: slug.max(120),
	parentId: id.nullable().optional(),
	sortOrder: z.number().int().default(0),
	isActive: z.boolean().default(true),
})

export const brandInputSchema = z.object({
	name: z.string().trim().min(1).max(100),
	logoUrl: z.url().max(500).nullable().optional(),
	isActive: z.boolean().default(true),
})

const imageSchema = z.object({
	url: z.url().max(500),
	alt: z.string().trim().max(191).nullable().optional(),
	sortOrder: z.number().int().default(0),
})

const skuSchema = z.object({
	skuCode: z.string().trim().min(1).max(80),
	name: z.string().trim().min(1).max(191),
	specifications: z.record(z.string(), z.string().max(100)),
	price: z.number().int().min(0),
	marketPrice: z.number().int().min(0).nullable().optional(),
	isActive: z.boolean().default(true),
	stock: z.number().int().min(0).default(0),
})

export const productCreateSchema = z.object({
	categoryId: id,
	brandId: id.nullable().optional(),
	name: z.string().trim().min(1).max(191),
	subtitle: z.string().trim().max(255).nullable().optional(),
	slug,
	description: z.string().nullable().optional(),
	sortOrder: z.number().int().default(0),
	images: z.array(imageSchema).max(20).default([]),
	skus: z.array(skuSchema).min(1).max(100),
})

export const productUpdateSchema = z
	.object({
		categoryId: id.optional(),
		brandId: id.nullable().optional(),
		name: z.string().trim().min(1).max(191).optional(),
		subtitle: z.string().trim().max(255).nullable().optional(),
		slug: slug.optional(),
		description: z.string().nullable().optional(),
		sortOrder: z.number().int().optional(),
		images: z.array(imageSchema).max(20).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, { message: '没有可更新的商品信息' })

export const productStatusSchema = z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']) })

export const productIdSchema = z.object({ productId: id })
export const skuCreateSchema = skuSchema.omit({ stock: true }).extend({ stock: z.number().int().min(0).default(0) })
export const skuUpdateSchema = skuSchema
	.omit({ stock: true })
	.partial()
	.refine((value) => Object.keys(value).length > 0, {
		message: '没有可更新的 SKU 信息',
	})

export const inventoryAdjustSchema = z.object({
	id,
	difference: z
		.number()
		.int()
		.refine((value) => value !== 0, { message: '库存调整数量不能为 0' }),
	remark: z.string().trim().min(1).max(255),
})

export const categoryUpdateSchema = categoryInputSchema.extend({ id })
export const brandUpdateSchema = brandInputSchema.extend({ id })
export const productUpdateBodySchema = productUpdateSchema.and(z.object({ id }))
export const productStatusBodySchema = productStatusSchema.extend({ id })
export const skuCreateBodySchema = skuCreateSchema.extend({ productId: id })
export const skuUpdateBodySchema = skuUpdateSchema.and(z.object({ id }))

export const adminProductListSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	keyword: z.string().trim().max(100).optional(),
	status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED']).optional(),
})
