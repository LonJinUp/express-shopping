const schema = (name) => ({ $ref: `#/components/schemas/${name}` })
const id = { type: 'string', minLength: 1, maxLength: 30, example: 'cm1234567890' }
const money = { type: 'integer', minimum: 0, description: '金额，单位：分', example: 9900 }
const dateTime = { type: 'string', format: 'date-time' }

const responses = {
	200: { description: '请求成功', content: { 'application/json': { schema: schema('SuccessResponse') } } },
	401: { description: '未登录或签名无效', content: { 'application/json': { schema: schema('ErrorResponse') } } },
	403: { description: '无权限', content: { 'application/json': { schema: schema('ErrorResponse') } } },
	422: { description: '请求参数校验失败', content: { 'application/json': { schema: schema('ErrorResponse') } } },
}

const queryParameter = (name, valueSchema, description) => ({ in: 'query', name, schema: valueSchema, description })
const pagination = [
	queryParameter('page', { type: 'integer', minimum: 1, default: 1 }, '页码'),
	queryParameter('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, '每页数量'),
]
const jsonBody = (bodySchema, required = true) => ({
	required,
	content: { 'application/json': { schema: bodySchema } },
})
const operation = (summary, tag, options = {}) => ({
	summary,
	tags: [tag],
	...(options.description ? { description: options.description } : {}),
	...(options.auth ? { security: [{ bearerAuth: [] }] } : {}),
	...(options.admin
		? {
				security: [{ bearerAuth: [] }],
				description: `${options.description ? `${options.description}\n\n` : ''}需要 ADMIN 角色。`,
			}
		: {}),
	...(options.parameters ? { parameters: options.parameters } : {}),
	...(options.body ? { requestBody: jsonBody(options.body) } : {}),
	responses: options.responses ?? responses,
})

const callbackHeaders = [
	{
		in: 'header',
		name: 'x-payment-timestamp',
		required: true,
		description: 'Unix 时间戳（秒）',
		schema: { type: 'string' },
	},
	{
		in: 'header',
		name: 'x-payment-signature',
		required: true,
		description: '`<timestamp>.<rawBody>` 的 HMAC-SHA256 十六进制摘要',
		schema: { type: 'string' },
	},
]

const orderStatuses = [
	'PENDING_PAYMENT',
	'PAID',
	'PROCESSING',
	'SHIPPED',
	'COMPLETED',
	'CANCELLED',
	'AFTER_SALE',
	'REFUNDING',
	'REFUNDED',
]
const afterSaleStatuses = [
	'PENDING',
	'ARBITRATING',
	'APPROVED',
	'WAITING_RETURN',
	'RETURNED',
	'REFUNDING',
	'COMPLETED',
	'REJECTED',
	'CANCELLED',
]

const paths = {
	'/health': { get: operation('存活检查', '系统', { responses: { 200: responses[200] } }) },
	'/ready': {
		get: operation('依赖就绪检查', '系统', {
			responses: { 200: responses[200], 503: { description: 'MySQL 或 Redis 不可用' } },
		}),
	},
	'/metrics': {
		get: operation('Prometheus 指标', '系统', {
			description: '仅在 `METRICS_ENABLED=true` 时开启。',
			parameters: [
				{ in: 'header', name: 'Authorization', required: true, schema: { type: 'string', example: 'Bearer token' } },
			],
			responses: { 200: { description: 'Prometheus text format' }, 401: responses[401] },
		}),
	},
	'/api/v1': { get: operation('API 版本信息', '系统') },

	'/api/v1/auth/register': { post: operation('注册', '认证', { body: schema('RegisterInput') }) },
	'/api/v1/auth/login': { post: operation('登录', '认证', { body: schema('LoginInput') }) },
	'/api/v1/auth/refresh': { post: operation('轮换刷新令牌', '认证', { body: schema('RefreshInput') }) },
	'/api/v1/auth/logout': { post: operation('退出当前会话', '认证', { auth: true }) },
	'/api/v1/auth/forgot-password': {
		post: operation('申请密码重置令牌', '认证', { body: schema('ForgotPasswordInput') }),
	},
	'/api/v1/auth/reset-password': {
		post: operation('重置密码', '认证', { body: schema('ResetPasswordInput') }),
	},

	'/api/v1/profile': { get: operation('获取个人资料', '用户', { auth: true }) },
	'/api/v1/profile/update': {
		post: operation('修改个人资料', '用户', { auth: true, body: schema('ProfileInput') }),
	},
	'/api/v1/addresses': { get: operation('收货地址列表', '用户', { auth: true }) },
	'/api/v1/addresses/create': {
		post: operation('新增收货地址', '用户', { auth: true, body: schema('AddressInput') }),
	},
	'/api/v1/addresses/update': {
		post: operation('修改收货地址', '用户', {
			auth: true,
			body: schema('AddressUpdateInput'),
		}),
	},
	'/api/v1/addresses/delete': {
		post: operation('删除收货地址', '用户', { auth: true, body: schema('IdInput') }),
	},
	'/api/v1/merchant-applications/create': {
		post: operation('提交商户入驻申请', '商户入驻', { auth: true, body: schema('MerchantApplicationInput') }),
	},
	'/api/v1/merchant-applications/mine': {
		get: operation('我的商户入驻申请', '商户入驻', { auth: true }),
	},
	'/api/v1/merchant/shops': {
		get: operation('我的商户与店铺', '商户管理', { auth: true }),
	},
	'/api/v1/merchant/shops/update': {
		post: operation('修改店铺资料', '商户管理', { auth: true, body: schema('ShopUpdateInput') }),
	},
	'/api/v1/merchant/members': {
		get: operation('商户成员列表', '商户管理', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID')],
		}),
	},
	'/api/v1/merchant/members/add': {
		post: operation('添加商户成员', '商户管理', { auth: true, body: schema('MerchantMemberAddInput') }),
	},
	'/api/v1/merchant/members/update': {
		post: operation('更新商户成员', '商户管理', { auth: true, body: schema('MerchantMemberUpdateInput') }),
	},
	'/api/v1/merchant/audit-logs': {
		get: operation('商户操作审计日志', '商户管理', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), ...pagination],
		}),
	},
	'/api/v1/merchant/products': {
		get: operation('商户商品列表', '商户商品管理', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				...pagination,
				queryParameter('keyword', { type: 'string', maxLength: 100 }, '关键词'),
				queryParameter('status', { type: 'string', enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED'] }, '商品状态'),
			],
		}),
	},
	'/api/v1/merchant/products/detail': {
		get: operation('商户商品详情', '商户商品管理', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), queryParameter('id', id, '商品 ID')],
		}),
	},
	'/api/v1/merchant/products/create': {
		post: operation('商户创建商品', '商户商品管理', { auth: true, body: schema('MerchantProductInput') }),
	},
	'/api/v1/merchant/products/update': {
		post: operation('商户修改商品', '商户商品管理', { auth: true, body: schema('MerchantProductUpdateInput') }),
	},
	'/api/v1/merchant/products/status': {
		post: operation('商户修改商品状态', '商户商品管理', {
			auth: true,
			body: schema('MerchantProductStatusInput'),
		}),
	},
	'/api/v1/merchant/products/delete': {
		post: operation('商户删除商品', '商户商品管理', { auth: true, body: schema('ShopScopedIdInput') }),
	},
	'/api/v1/merchant/skus/create': {
		post: operation('商户创建 SKU', '商户商品管理', { auth: true, body: schema('MerchantSkuCreateInput') }),
	},
	'/api/v1/merchant/skus/update': {
		post: operation('商户修改 SKU', '商户商品管理', { auth: true, body: schema('MerchantSkuUpdateInput') }),
	},
	'/api/v1/merchant/skus/inventory/adjust': {
		post: operation('商户调整库存', '商户商品管理', {
			auth: true,
			body: schema('MerchantInventoryAdjustInput'),
		}),
	},
	'/api/v1/merchant/orders': {
		get: operation('商户订单列表', '商户订单管理', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				...pagination,
				queryParameter('status', { type: 'string', enum: orderStatuses.slice(0, 6) }, '订单状态'),
				queryParameter('orderNo', { type: 'string', maxLength: 32 }, '订单号'),
			],
		}),
	},
	'/api/v1/merchant/orders/detail': {
		get: operation('商户订单详情', '商户订单管理', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), queryParameter('id', id, '订单 ID')],
		}),
	},
	'/api/v1/merchant/orders/accept': {
		post: operation('商户接单', '商户订单管理', { auth: true, body: schema('ShopScopedIdInput') }),
	},
	'/api/v1/merchant/orders/ship': {
		post: operation('商户订单发货', '商户订单管理', { auth: true, body: schema('MerchantShipmentInput') }),
	},
	'/api/v1/merchant/orders/notes/create': {
		post: operation('商户添加订单备注', '商户订单管理', {
			auth: true,
			body: schema('MerchantOrderNoteInput'),
		}),
	},
	'/api/v1/merchant/coupons': {
		get: operation('商户优惠券列表', '商户营销管理', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				...pagination,
				queryParameter('isActive', { type: 'boolean' }, '是否启用'),
			],
		}),
	},
	'/api/v1/merchant/coupons/create': {
		post: operation('商户创建优惠券', '商户营销管理', { auth: true, body: schema('MerchantCouponInput') }),
	},
	'/api/v1/merchant/shipping-templates': {
		get: operation('商户运费模板列表', '商户营销管理', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID')],
		}),
	},
	'/api/v1/merchant/shipping-templates/create': {
		post: operation('商户创建运费模板', '商户营销管理', {
			auth: true,
			body: schema('MerchantShippingTemplateInput'),
		}),
	},
	'/api/v1/merchant/after-sales': {
		get: operation('商户售后列表', '商户售后管理', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				...pagination,
				queryParameter('status', { type: 'string', enum: afterSaleStatuses }, '售后状态'),
			],
		}),
	},
	'/api/v1/merchant/after-sales/detail': {
		get: operation('商户售后详情', '商户售后管理', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), queryParameter('id', id, '售后单 ID')],
		}),
	},
	'/api/v1/merchant/after-sales/review': {
		post: operation('商户审核售后', '商户售后管理', {
			auth: true,
			body: schema('MerchantAfterSaleReviewInput'),
		}),
	},
	'/api/v1/merchant/after-sales/confirm-return': {
		post: operation('商户确认退货', '商户售后管理', { auth: true, body: schema('ShopScopedIdInput') }),
	},
	'/api/v1/merchant/after-sales/refund': {
		post: operation('商户创建退款单', '商户售后管理', {
			auth: true,
			body: schema('MerchantChannelRefundInput'),
		}),
	},
	'/api/v1/merchant/after-sales/retry-refund': {
		post: operation('商户重试退款', '商户售后管理', { auth: true, body: schema('ShopScopedIdInput') }),
	},
	'/api/v1/merchant/after-sales/mock-refund': {
		post: operation('商户模拟退款', '商户售后管理', {
			auth: true,
			body: schema('MerchantAfterSaleMockRefundInput'),
		}),
	},
	'/api/v1/merchant/analytics/dashboard': {
		get: operation('商户经营看板', '商户经营分析', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				queryParameter('startDate', dateTime, '开始时间'),
				queryParameter('endDate', dateTime, '结束时间'),
				queryParameter('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, '热销商品数量'),
			],
		}),
	},
	'/api/v1/merchant/finance/account': {
		get: operation('商户资金账户', '商户财务', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID')],
		}),
	},
	'/api/v1/merchant/finance/ledger': {
		get: operation('商户资金流水', '商户财务', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), ...pagination],
		}),
	},
	'/api/v1/merchant/finance/ledger/export': {
		get: operation('导出店铺资金流水 CSV', '商户财务', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				queryParameter('startDate', dateTime, '开始时间'),
				queryParameter('endDate', dateTime, '结束时间'),
			],
			responses: { 200: { description: 'UTF-8 BOM CSV', content: { 'text/csv': { schema: { type: 'string' } } } } },
		}),
	},
	'/api/v1/merchant/finance/settlements/create': {
		post: operation('生成商户结算单', '商户财务', { auth: true, body: schema('MerchantSettlementInput') }),
	},
	'/api/v1/merchant/finance/settlements': {
		get: operation('商户结算单列表', '商户财务', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), ...pagination],
		}),
	},
	'/api/v1/merchant/finance/withdrawals/create': {
		post: operation('申请提现', '商户财务', { auth: true, body: schema('MerchantWithdrawalInput') }),
	},
	'/api/v1/merchant/finance/withdrawals': {
		get: operation('商户提现记录', '商户财务', {
			auth: true,
			parameters: [queryParameter('shopId', id, '店铺 ID'), ...pagination],
		}),
	},
	'/api/v1/merchant/orders/export': {
		get: operation('商户导出订单 CSV', '商户经营分析', {
			auth: true,
			parameters: [
				queryParameter('shopId', id, '店铺 ID'),
				queryParameter('startDate', dateTime, '开始时间'),
				queryParameter('endDate', dateTime, '结束时间'),
				queryParameter('status', { type: 'string', enum: orderStatuses.slice(0, 6) }, '订单状态'),
			],
			responses: { 200: { description: 'UTF-8 BOM CSV', content: { 'text/csv': { schema: { type: 'string' } } } } },
		}),
	},

	'/api/v1/categories': { get: operation('分类列表', '商品') },
	'/api/v1/brands': { get: operation('品牌列表', '商品') },
	'/api/v1/products': {
		get: operation('商品搜索与筛选', '商品', {
			parameters: [
				...pagination,
				queryParameter('keyword', { type: 'string', maxLength: 100 }, '关键词'),
				queryParameter('categoryId', id, '分类 ID'),
				queryParameter('brandId', id, '品牌 ID'),
				queryParameter('minPrice', money, '最低价'),
				queryParameter('maxPrice', money, '最高价'),
			],
		}),
	},
	'/api/v1/products/detail': {
		get: operation('商品详情', '商品', { parameters: [queryParameter('id', id, '商品 ID')] }),
	},
	'/api/v1/products/reviews': {
		get: operation('商品公开评价', '评价', {
			parameters: [queryParameter('productId', id, '商品 ID'), ...pagination],
		}),
	},

	'/api/v1/cart': { get: operation('获取购物车', '购物车', { auth: true }) },
	'/api/v1/cart/items/add': {
		post: operation('加入购物车', '购物车', { auth: true, body: schema('CartAddInput') }),
	},
	'/api/v1/cart/items/update': {
		post: operation('修改购物车商品', '购物车', {
			auth: true,
			body: schema('CartUpdateInput'),
		}),
	},
	'/api/v1/cart/items/delete': {
		post: operation('删除购物车商品', '购物车', { auth: true, body: schema('IdInput') }),
	},
	'/api/v1/cart/items/select': {
		post: operation('批量勾选购物车', '购物车', { auth: true, body: schema('CartSelectInput') }),
	},
	'/api/v1/checkout/preview': {
		post: operation('购物车结算预览', '订单', { auth: true, body: schema('CheckoutPreviewInput') }),
	},
	'/api/v1/checkout/direct-preview': {
		post: operation('立即购买结算预览', '订单', { auth: true, body: schema('DirectPreviewInput') }),
	},
	'/api/v1/orders/create': {
		post: operation('创建订单', '订单', { auth: true, body: schema('CreateOrderInput') }),
	},
	'/api/v1/orders': {
		get: operation('我的订单', '订单', {
			auth: true,
			parameters: [...pagination, queryParameter('status', { type: 'string', enum: orderStatuses }, '订单状态')],
		}),
	},
	'/api/v1/orders/detail': {
		get: operation('订单详情', '订单', { auth: true, parameters: [queryParameter('id', id, '订单 ID')] }),
	},
	'/api/v1/platform-orders': {
		get: operation('我的平台订单', '订单', { auth: true, parameters: pagination }),
	},
	'/api/v1/platform-orders/detail': {
		get: operation('平台订单详情', '订单', { auth: true, parameters: [queryParameter('id', id, '平台订单 ID')] }),
	},
	'/api/v1/orders/cancel': {
		post: operation('取消待支付订单', '订单', { auth: true, body: schema('CancelOrderInput') }),
	},
	'/api/v1/orders/confirm-receipt': {
		post: operation('确认收货', '订单', { auth: true, body: schema('IdInput') }),
	},
	'/api/v1/orders/buy-again': {
		post: operation('再次购买', '订单', { auth: true, body: schema('IdInput') }),
	},

	'/api/v1/payments/create': {
		post: operation('创建渠道支付单', '支付', { auth: true, body: schema('ChannelPaymentInput') }),
	},
	'/api/v1/payments/mock-pay': {
		post: operation('模拟支付', '支付', { auth: true, body: schema('MockPaymentInput') }),
	},
	'/api/v1/payments/callback': {
		post: operation('支付渠道回调', '支付', {
			parameters: callbackHeaders,
			body: schema('PaymentCallbackInput'),
		}),
	},
	'/api/v1/refunds/callback': {
		post: operation('退款渠道回调', '售后', {
			parameters: callbackHeaders,
			body: schema('RefundCallbackInput'),
		}),
	},

	'/api/v1/reviews/create': {
		post: operation('发布商品评价', '评价', { auth: true, body: schema('ReviewInput') }),
	},
	'/api/v1/coupons': { get: operation('可领取优惠券', '营销') },
	'/api/v1/user-coupons': {
		get: operation('我的优惠券', '营销', {
			auth: true,
			parameters: [queryParameter('status', { type: 'string', enum: ['AVAILABLE', 'USED', 'EXPIRED'] }, '优惠券状态')],
		}),
	},
	'/api/v1/coupons/claim': {
		post: operation('领取优惠券', '营销', { auth: true, body: schema('IdInput') }),
	},

	'/api/v1/home': { get: operation('商城首页内容', '用户互动') },
	'/api/v1/favorites': { get: operation('收藏列表', '用户互动', { auth: true }) },
	'/api/v1/products/favorite': {
		post: operation('收藏商品', '用户互动', { auth: true, body: schema('IdInput') }),
	},
	'/api/v1/products/unfavorite': {
		post: operation('取消收藏', '用户互动', { auth: true, body: schema('IdInput') }),
	},
	'/api/v1/products/view': {
		post: operation('记录浏览足迹', '用户互动', { auth: true, body: schema('IdInput') }),
	},
	'/api/v1/browsing-history': { get: operation('浏览足迹', '用户互动', { auth: true }) },
	'/api/v1/browsing-history/clear': { post: operation('清空浏览足迹', '用户互动', { auth: true }) },

	'/api/v1/after-sales/create': {
		post: operation('申请售后', '售后', { auth: true, body: schema('AfterSaleInput') }),
	},
	'/api/v1/after-sales': {
		get: operation('我的售后单', '售后', {
			auth: true,
			parameters: [...pagination, queryParameter('status', { type: 'string', enum: afterSaleStatuses }, '售后状态')],
		}),
	},
	'/api/v1/after-sales/detail': {
		get: operation('售后详情', '售后', { auth: true, parameters: [queryParameter('id', id, '售后单 ID')] }),
	},
	'/api/v1/after-sales/return-shipment': {
		post: operation('填写退货物流', '售后', {
			auth: true,
			body: schema('ShipmentInput'),
		}),
	},
	'/api/v1/after-sales/arbitration/request': {
		post: operation('申请平台介入售后', '售后', {
			auth: true,
			body: schema('ArbitrationRequestInput'),
		}),
	},

	'/api/v1/admin/categories/create': {
		post: operation('创建分类', '商品管理', { admin: true, body: schema('CategoryInput') }),
	},
	'/api/v1/admin/merchant-applications': {
		get: operation('入驻申请列表', '平台商户管理', {
			admin: true,
			parameters: [
				...pagination,
				queryParameter('status', { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] }, '审核状态'),
			],
		}),
	},
	'/api/v1/admin/merchant-applications/review': {
		post: operation('审核商户入驻申请', '平台商户管理', {
			admin: true,
			body: schema('MerchantApplicationReviewInput'),
		}),
	},
	'/api/v1/admin/categories/update': {
		post: operation('修改分类', '商品管理', {
			admin: true,
			body: schema('CategoryUpdateInput'),
		}),
	},
	'/api/v1/admin/brands/create': {
		post: operation('创建品牌', '商品管理', { admin: true, body: schema('BrandInput') }),
	},
	'/api/v1/admin/brands/update': {
		post: operation('修改品牌', '商品管理', {
			admin: true,
			body: schema('BrandUpdateInput'),
		}),
	},
	'/api/v1/admin/products': {
		get: operation('管理端商品列表', '商品管理', {
			admin: true,
			parameters: [
				...pagination,
				queryParameter('keyword', { type: 'string', maxLength: 100 }, '关键词'),
				queryParameter('status', { type: 'string', enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'DELETED'] }, '商品状态'),
			],
		}),
	},
	'/api/v1/admin/products/detail': {
		get: operation('管理端商品详情', '商品管理', {
			admin: true,
			parameters: [queryParameter('id', id, '商品 ID')],
		}),
	},
	'/api/v1/admin/products/create': {
		post: operation('创建商品及 SKU', '商品管理', { admin: true, body: schema('ProductInput') }),
	},
	'/api/v1/admin/products/update': {
		post: operation('修改商品', '商品管理', {
			admin: true,
			body: schema('ProductUpdateInput'),
		}),
	},
	'/api/v1/admin/products/status': {
		post: operation('修改商品状态', '商品管理', {
			admin: true,
			body: schema('ProductStatusInput'),
		}),
	},
	'/api/v1/admin/products/delete': {
		post: operation('软删除商品', '商品管理', { admin: true, body: schema('IdInput') }),
	},
	'/api/v1/admin/skus/create': {
		post: operation('新增 SKU', '商品管理', {
			admin: true,
			body: schema('SkuCreateInput'),
		}),
	},
	'/api/v1/admin/skus/update': {
		post: operation('修改 SKU', '商品管理', {
			admin: true,
			body: schema('SkuUpdateInput'),
		}),
	},
	'/api/v1/admin/skus/inventory/adjust': {
		post: operation('调整库存', '商品管理', {
			admin: true,
			body: schema('InventoryAdjustInput'),
		}),
	},
	'/api/v1/admin/uploads/images': {
		post: {
			summary: '上传商品图片',
			tags: ['商品管理'],
			security: [{ bearerAuth: [] }],
			description: '需要 ADMIN 角色。支持 JPEG、PNG、WebP 和 GIF，会校验真实文件类型。',
			requestBody: {
				required: true,
				content: {
					'multipart/form-data': {
						schema: {
							type: 'object',
							required: ['image'],
							properties: { image: { type: 'string', format: 'binary' } },
						},
					},
				},
			},
			responses,
		},
	},

	'/api/v1/admin/orders': {
		get: operation('管理端订单列表', '订单管理', {
			admin: true,
			parameters: [
				...pagination,
				queryParameter('status', { type: 'string', enum: orderStatuses.slice(0, 6) }, '订单状态'),
				queryParameter('orderNo', { type: 'string', maxLength: 32 }, '订单号'),
			],
		}),
	},
	'/api/v1/admin/orders/detail': {
		get: operation('管理端订单详情', '订单管理', {
			admin: true,
			parameters: [queryParameter('id', id, '订单 ID')],
		}),
	},
	'/api/v1/admin/orders/accept': {
		post: operation('商家接单', '订单管理', { admin: true, body: schema('IdInput') }),
	},
	'/api/v1/admin/orders/ship': {
		post: operation('订单发货', '订单管理', {
			admin: true,
			body: schema('ShipmentInput'),
		}),
	},
	'/api/v1/admin/orders/notes/create': {
		post: operation('新增订单内部备注', '订单管理', {
			admin: true,
			body: schema('OrderNoteInput'),
		}),
	},
	'/api/v1/admin/orders/export': {
		get: operation('导出订单 CSV', '订单管理', {
			admin: true,
			parameters: [
				queryParameter('startDate', dateTime, '开始时间'),
				queryParameter('endDate', dateTime, '结束时间'),
				queryParameter('status', { type: 'string', enum: orderStatuses.slice(0, 6) }, '订单状态'),
			],
			responses: { 200: { description: 'UTF-8 BOM CSV', content: { 'text/csv': { schema: { type: 'string' } } } } },
		}),
	},

	'/api/v1/admin/reviews': {
		get: operation('评价审核列表', '运营管理', {
			admin: true,
			parameters: [
				...pagination,
				queryParameter('status', { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] }, '审核状态'),
			],
		}),
	},
	'/api/v1/admin/reviews/moderate': {
		post: operation('审核评价', '运营管理', {
			admin: true,
			body: schema('ReviewModerateInput'),
		}),
	},
	'/api/v1/admin/coupons/create': {
		post: operation('创建优惠券', '运营管理', { admin: true, body: schema('CouponInput') }),
	},
	'/api/v1/admin/shipping-templates/create': {
		post: operation('创建运费模板', '运营管理', { admin: true, body: schema('ShippingTemplateInput') }),
	},
	'/api/v1/admin/home-blocks': { get: operation('首页内容列表', '运营管理', { admin: true }) },
	'/api/v1/admin/home-blocks/create': {
		post: operation('创建首页内容', '运营管理', { admin: true, body: schema('HomeBlockInput') }),
	},
	'/api/v1/admin/home-blocks/update': {
		post: operation('修改首页内容', '运营管理', {
			admin: true,
			body: schema('HomeBlockUpdateInput'),
		}),
	},
	'/api/v1/admin/home-blocks/delete': {
		post: operation('删除首页内容', '运营管理', { admin: true, body: schema('IdInput') }),
	},
	'/api/v1/admin/analytics/dashboard': {
		get: operation('经营数据看板', '运营管理', {
			admin: true,
			parameters: [
				queryParameter('startDate', dateTime, '开始时间'),
				queryParameter('endDate', dateTime, '结束时间'),
				queryParameter('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, '热销商品数量'),
			],
		}),
	},

	'/api/v1/admin/after-sales': {
		get: operation('管理端售后列表', '售后管理', {
			admin: true,
			parameters: [...pagination, queryParameter('status', { type: 'string', enum: afterSaleStatuses }, '售后状态')],
		}),
	},
	'/api/v1/admin/after-sales/detail': {
		get: operation('管理端售后详情', '售后管理', {
			admin: true,
			parameters: [queryParameter('id', id, '售后单 ID')],
		}),
	},
	'/api/v1/admin/after-sales/review': {
		post: operation('审核售后', '售后管理', {
			admin: true,
			body: schema('AfterSaleReviewInput'),
		}),
	},
	'/api/v1/admin/after-sales/confirm-return': {
		post: operation('确认收到退货', '售后管理', { admin: true, body: schema('IdInput') }),
	},
	'/api/v1/admin/after-sales/refund': {
		post: operation('创建渠道退款单', '售后管理', {
			admin: true,
			body: schema('ChannelRefundInput'),
		}),
	},
	'/api/v1/admin/after-sales/retry-refund': {
		post: operation('重试失败退款', '售后管理', { admin: true, body: schema('IdInput') }),
	},
	'/api/v1/admin/after-sales/mock-refund': {
		post: operation('模拟退款', '售后管理', {
			admin: true,
			body: schema('AfterSaleMockRefundInput'),
		}),
	},
	'/api/v1/admin/after-sales/arbitrations': {
		get: operation('平台仲裁列表', '售后管理', {
			admin: true,
			parameters: [
				...pagination,
				queryParameter('status', { type: 'string', enum: ['PENDING', 'RESOLVED'] }, '仲裁状态'),
			],
		}),
	},
	'/api/v1/admin/after-sales/arbitrations/resolve': {
		post: operation('处理平台仲裁', '售后管理', {
			admin: true,
			body: schema('ArbitrationResolveInput'),
		}),
	},
	'/api/v1/admin/finance/withdrawals': {
		get: operation('平台提现审核列表', '平台财务', { admin: true, parameters: pagination }),
	},
	'/api/v1/admin/finance/withdrawals/review': {
		post: operation('审核或完成提现', '平台财务', { admin: true, body: schema('WithdrawalReviewInput') }),
	},
	'/api/v1/admin/shops/commission/update': {
		post: operation('设置店铺佣金比例', '平台财务', { admin: true, body: schema('CommissionUpdateInput') }),
	},
}

export const openapiDocument = {
	openapi: '3.1.0',
	info: {
		title: 'Express Shop API',
		version: '0.1.0',
		description:
			'支持单商户并逐步升级多商户的商城 HTTP API。金额均使用整数最小货币单位（人民币：分）；写操作统一使用 POST。',
	},
	servers: [{ url: '/', description: '当前服务' }],
	tags: [
		{ name: '系统' },
		{ name: '认证' },
		{ name: '用户' },
		{ name: '商品' },
		{ name: '购物车' },
		{ name: '订单' },
		{ name: '支付' },
		{ name: '评价' },
		{ name: '营销' },
		{ name: '用户互动' },
		{ name: '售后' },
		{ name: '商户入驻' },
		{ name: '商户管理' },
		{ name: '商户商品管理' },
		{ name: '商户订单管理' },
		{ name: '商户营销管理' },
		{ name: '商户售后管理' },
		{ name: '商户经营分析' },
		{ name: '平台商户管理' },
		{ name: '商品管理' },
		{ name: '订单管理' },
		{ name: '运营管理' },
		{ name: '售后管理' },
	],
	paths,
	components: {
		securitySchemes: {
			bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: '登录返回的 accessToken' },
		},
		schemas: {
			ShopScopeInput: {
				type: 'object',
				required: ['shopId'],
				properties: { shopId: id },
			},
			ShopScopedIdInput: { allOf: [schema('ShopScopeInput'), schema('IdInput')] },
			MerchantProductInput: { allOf: [schema('ShopScopeInput'), schema('ProductInput')] },
			MerchantProductUpdateInput: { allOf: [schema('ShopScopeInput'), schema('ProductUpdateInput')] },
			MerchantProductStatusInput: { allOf: [schema('ShopScopeInput'), schema('ProductStatusInput')] },
			MerchantSkuCreateInput: { allOf: [schema('ShopScopeInput'), schema('SkuCreateInput')] },
			MerchantSkuUpdateInput: { allOf: [schema('ShopScopeInput'), schema('SkuUpdateInput')] },
			MerchantInventoryAdjustInput: { allOf: [schema('ShopScopeInput'), schema('InventoryAdjustInput')] },
			MerchantShipmentInput: { allOf: [schema('ShopScopeInput'), schema('ShipmentInput')] },
			MerchantOrderNoteInput: { allOf: [schema('ShopScopeInput'), schema('OrderNoteInput')] },
			MerchantCouponInput: { allOf: [schema('ShopScopeInput'), schema('CouponInput')] },
			MerchantShippingTemplateInput: { allOf: [schema('ShopScopeInput'), schema('ShippingTemplateInput')] },
			MerchantAfterSaleReviewInput: { allOf: [schema('ShopScopeInput'), schema('AfterSaleReviewInput')] },
			MerchantChannelRefundInput: { allOf: [schema('ShopScopeInput'), schema('ChannelRefundInput')] },
			MerchantAfterSaleMockRefundInput: {
				allOf: [schema('ShopScopeInput'), schema('AfterSaleMockRefundInput')],
			},
			MerchantApplicationInput: {
				type: 'object',
				required: [
					'clientRequestId',
					'merchantName',
					'merchantCode',
					'shopName',
					'shopCode',
					'contactName',
					'contactPhone',
				],
				properties: {
					clientRequestId: { type: 'string', minLength: 8, maxLength: 64 },
					merchantName: { type: 'string', minLength: 2, maxLength: 120 },
					merchantCode: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[A-Z0-9_-]+$' },
					shopName: { type: 'string', minLength: 2, maxLength: 120 },
					shopCode: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[A-Z0-9_-]+$' },
					contactName: { type: 'string', minLength: 2, maxLength: 80 },
					contactPhone: { type: 'string', minLength: 6, maxLength: 30 },
					qualificationUrl: { type: ['string', 'null'], format: 'uri', maxLength: 500 },
				},
			},
			MerchantApplicationReviewInput: {
				type: 'object',
				required: ['id', 'action'],
				properties: {
					id,
					action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
					reason: { type: 'string', minLength: 2, maxLength: 500 },
				},
			},
			ShopUpdateInput: {
				type: 'object',
				required: ['id'],
				minProperties: 2,
				properties: {
					id,
					name: { type: 'string', minLength: 2, maxLength: 120 },
					description: { type: ['string', 'null'], maxLength: 500 },
					logoUrl: { type: ['string', 'null'], format: 'uri', maxLength: 500 },
				},
			},
			MerchantMemberAddInput: {
				type: 'object',
				required: ['shopId', 'identifier', 'role'],
				properties: {
					shopId: id,
					identifier: { type: 'string', minLength: 3, maxLength: 191, description: '用户邮箱或手机号' },
					role: { type: 'string', enum: ['ADMIN', 'STAFF'] },
				},
			},
			MerchantMemberUpdateInput: {
				type: 'object',
				required: ['shopId', 'userId'],
				properties: {
					shopId: id,
					userId: id,
					role: { type: 'string', enum: ['ADMIN', 'STAFF'] },
					status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
				},
			},
			SuccessResponse: {
				type: 'object',
				required: ['code', 'message', 'data', 'requestId'],
				properties: {
					code: { type: 'string', example: 'OK' },
					message: { type: 'string', example: 'success' },
					data: {},
					requestId: { type: 'string' },
				},
			},
			ErrorResponse: {
				type: 'object',
				required: ['code', 'message', 'data', 'requestId'],
				properties: {
					code: { type: 'string', example: 'VALIDATION_ERROR' },
					message: { type: 'string' },
					data: { type: 'null' },
					details: { type: 'object', additionalProperties: true },
					requestId: { type: 'string' },
				},
			},
			RegisterInput: {
				type: 'object',
				required: ['password', 'nickname'],
				properties: {
					email: { type: 'string', format: 'email', maxLength: 191 },
					phone: { type: 'string', minLength: 6, maxLength: 30 },
					password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 },
					nickname: { type: 'string', minLength: 1, maxLength: 80 },
				},
				description: 'email 和 phone 至少填写一项。',
			},
			LoginInput: {
				type: 'object',
				required: ['identifier', 'password'],
				properties: {
					identifier: { type: 'string', description: '邮箱或手机号' },
					password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 },
				},
			},
			RefreshInput: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
			ForgotPasswordInput: { type: 'object', required: ['identifier'], properties: { identifier: { type: 'string' } } },
			ResetPasswordInput: {
				type: 'object',
				required: ['token', 'password'],
				properties: {
					token: { type: 'string', minLength: 32, maxLength: 200 },
					password: { type: 'string', format: 'password', minLength: 8, maxLength: 72 },
				},
			},
			ProfileInput: {
				type: 'object',
				minProperties: 1,
				properties: {
					nickname: { type: 'string', maxLength: 80 },
					avatarUrl: { type: ['string', 'null'], format: 'uri' },
				},
			},
			AddressInput: {
				type: 'object',
				required: ['recipientName', 'phone', 'province', 'city', 'district', 'detail'],
				properties: {
					recipientName: { type: 'string', maxLength: 80 },
					phone: { type: 'string', minLength: 6, maxLength: 30 },
					province: { type: 'string', maxLength: 80 },
					city: { type: 'string', maxLength: 80 },
					district: { type: 'string', maxLength: 80 },
					detail: { type: 'string', maxLength: 255 },
					postalCode: { type: ['string', 'null'], maxLength: 20 },
					isDefault: { type: 'boolean', default: false },
				},
			},
			IdInput: { type: 'object', required: ['id'], properties: { id } },
			AddressUpdateInput: {
				allOf: [schema('AddressInput'), schema('IdInput')],
			},
			CartAddInput: {
				type: 'object',
				required: ['skuId', 'quantity'],
				properties: { skuId: id, quantity: { type: 'integer', minimum: 1, maximum: 999 } },
			},
			CartUpdateInput: {
				type: 'object',
				required: ['id'],
				minProperties: 2,
				properties: { id, quantity: { type: 'integer', minimum: 1, maximum: 999 }, selected: { type: 'boolean' } },
				description: '除 id 外，quantity 和 selected 至少传递一项。',
			},
			CartSelectInput: {
				type: 'object',
				required: ['itemIds', 'selected'],
				properties: { itemIds: { type: 'array', maxItems: 200, items: id }, selected: { type: 'boolean' } },
			},
			ShopCouponInput: {
				type: 'object',
				required: ['shopId', 'userCouponId'],
				properties: { shopId: id, userCouponId: id },
			},
			CheckoutPreviewInput: {
				type: 'object',
				required: ['addressId'],
				properties: {
					addressId: id,
					itemIds: { type: 'array', minItems: 1, maxItems: 200, items: id },
					userCouponId: id,
					userCoupons: { type: 'array', maxItems: 100, items: schema('ShopCouponInput') },
				},
				description: '单店可继续传 userCouponId；跨店时通过 userCoupons 为每个店铺选择一张优惠券。',
			},
			DirectPreviewInput: {
				type: 'object',
				required: ['addressId', 'skuId', 'quantity'],
				properties: {
					addressId: id,
					skuId: id,
					quantity: { type: 'integer', minimum: 1, maximum: 999 },
					userCouponId: id,
				},
			},
			CreateOrderInput: {
				oneOf: [
					{
						type: 'object',
						required: ['source', 'clientRequestId', 'addressId', 'cartItemIds'],
						properties: {
							source: { const: 'CART' },
							clientRequestId: { type: 'string', minLength: 8, maxLength: 64 },
							addressId: id,
							userCouponId: id,
							userCoupons: { type: 'array', maxItems: 100, items: schema('ShopCouponInput') },
							cartItemIds: { type: 'array', minItems: 1, maxItems: 200, items: id },
							buyerMessage: { type: 'string', maxLength: 255 },
						},
					},
					{
						type: 'object',
						required: ['source', 'clientRequestId', 'addressId', 'skuId', 'quantity'],
						properties: {
							source: { const: 'DIRECT' },
							clientRequestId: { type: 'string', minLength: 8, maxLength: 64 },
							addressId: id,
							userCouponId: id,
							skuId: id,
							quantity: { type: 'integer', minimum: 1, maximum: 999 },
							buyerMessage: { type: 'string', maxLength: 255 },
						},
					},
				],
				discriminator: { propertyName: 'source' },
			},
			CancelOrderInput: {
				type: 'object',
				required: ['id'],
				properties: { id, reason: { type: 'string', maxLength: 255 } },
			},
			IdempotencyInput: {
				type: 'object',
				required: ['clientRequestId'],
				properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 64 } },
			},
			MockPaymentInput: {
				allOf: [schema('IdempotencyInput'), { type: 'object', required: ['orderId'], properties: { orderId: id } }],
			},
			ChannelPaymentInput: {
				allOf: [
					schema('MockPaymentInput'),
					{
						type: 'object',
						required: ['channel'],
						properties: { channel: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' } },
					},
				],
			},
			PaymentCallbackInput: {
				type: 'object',
				required: ['channel', 'eventId', 'paymentNo', 'transactionId', 'status', 'amount'],
				properties: {
					channel: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
					eventId: { type: 'string', maxLength: 100 },
					paymentNo: { type: 'string', maxLength: 32 },
					transactionId: { type: 'string', maxLength: 100 },
					status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
					amount: { ...money, minimum: 1 },
				},
			},
			RefundCallbackInput: {
				type: 'object',
				required: ['channel', 'eventId', 'refundNo', 'transactionId', 'status', 'amount'],
				properties: {
					channel: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
					eventId: { type: 'string', maxLength: 100 },
					refundNo: { type: 'string', maxLength: 32 },
					transactionId: { type: 'string', maxLength: 100 },
					status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
					amount: { ...money, minimum: 1 },
				},
			},
			ReviewInput: {
				type: 'object',
				required: ['orderItemId', 'rating'],
				properties: {
					orderItemId: id,
					rating: { type: 'integer', minimum: 1, maximum: 5 },
					content: { type: ['string', 'null'], maxLength: 1000 },
					isAnonymous: { type: 'boolean', default: false },
					images: { type: 'array', maxItems: 9, items: { type: 'string', format: 'uri' } },
				},
			},
			AfterSaleInput: {
				type: 'object',
				required: ['clientRequestId', 'orderId', 'type', 'reason', 'items'],
				properties: {
					clientRequestId: { type: 'string', minLength: 8, maxLength: 64 },
					orderId: id,
					type: { type: 'string', enum: ['REFUND_ONLY', 'RETURN_REFUND'] },
					reason: { type: 'string', maxLength: 255 },
					description: { type: ['string', 'null'], maxLength: 1000 },
					items: {
						type: 'array',
						minItems: 1,
						maxItems: 100,
						items: {
							type: 'object',
							required: ['orderItemId', 'quantity'],
							properties: { orderItemId: id, quantity: { type: 'integer', minimum: 1, maximum: 999 } },
						},
					},
				},
			},
			ShipmentInput: {
				type: 'object',
				required: ['id', 'carrierCode', 'carrierName', 'trackingNumber'],
				properties: {
					id,
					carrierCode: { type: 'string', maxLength: 50 },
					carrierName: { type: 'string', maxLength: 80 },
					trackingNumber: { type: 'string', maxLength: 100 },
				},
			},
			AfterSaleReviewInput: {
				type: 'object',
				required: ['id', 'action', 'remark'],
				properties: {
					id,
					action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
					approvedAmount: money,
					remark: { type: 'string', maxLength: 500 },
				},
			},
			ArbitrationRequestInput: {
				type: 'object',
				required: ['id', 'reason'],
				properties: {
					id,
					reason: { type: 'string', minLength: 2, maxLength: 500 },
					evidence: { type: 'array', maxItems: 10, items: { type: 'string', format: 'uri', maxLength: 500 } },
				},
			},
			ArbitrationResolveInput: {
				type: 'object',
				required: ['id', 'decision', 'remark'],
				properties: {
					id,
					decision: { type: 'string', enum: ['APPROVE', 'REJECT'] },
					approvedAmount: { ...money, minimum: 1 },
					remark: { type: 'string', minLength: 2, maxLength: 500 },
				},
			},
			MerchantSettlementInput: {
				type: 'object',
				required: ['shopId', 'clientRequestId', 'periodStart', 'periodEnd'],
				properties: {
					shopId: id,
					clientRequestId: { type: 'string', minLength: 8, maxLength: 64 },
					periodStart: dateTime,
					periodEnd: dateTime,
				},
			},
			MerchantWithdrawalInput: {
				type: 'object',
				required: ['shopId', 'clientRequestId', 'amount', 'accountInfo'],
				properties: {
					shopId: id,
					clientRequestId: { type: 'string', minLength: 8, maxLength: 64 },
					amount: { ...money, minimum: 1 },
					accountInfo: {
						type: 'object',
						required: ['bankName', 'accountName', 'accountNo'],
						properties: {
							bankName: { type: 'string', maxLength: 100 },
							accountName: { type: 'string', maxLength: 100 },
							accountNo: { type: 'string', maxLength: 100 },
						},
					},
				},
			},
			WithdrawalReviewInput: {
				type: 'object',
				required: ['id', 'action', 'remark'],
				properties: {
					id,
					action: { type: 'string', enum: ['APPROVE', 'REJECT', 'COMPLETE'] },
					remark: { type: 'string', minLength: 2, maxLength: 500 },
				},
			},
			CommissionUpdateInput: {
				type: 'object',
				required: ['shopId', 'commissionRateBps'],
				properties: {
					shopId: id,
					commissionRateBps: {
						type: 'integer',
						minimum: 0,
						maximum: 10000,
						description: '万分比，500 表示 5%',
					},
				},
			},
			ChannelRefundInput: {
				allOf: [
					schema('IdempotencyInput'),
					schema('IdInput'),
					{
						type: 'object',
						required: ['channel'],
						properties: { channel: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' } },
					},
				],
			},
			CategoryInput: {
				type: 'object',
				required: ['name', 'slug'],
				properties: {
					name: { type: 'string', maxLength: 100 },
					slug: { type: 'string', maxLength: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
					parentId: { ...id, type: ['string', 'null'] },
					sortOrder: { type: 'integer', default: 0 },
					isActive: { type: 'boolean', default: true },
				},
			},
			CategoryUpdateInput: { allOf: [schema('CategoryInput'), schema('IdInput')] },
			BrandInput: {
				type: 'object',
				required: ['name'],
				properties: {
					name: { type: 'string', maxLength: 100 },
					logoUrl: { type: ['string', 'null'], format: 'uri' },
					isActive: { type: 'boolean', default: true },
				},
			},
			BrandUpdateInput: { allOf: [schema('BrandInput'), schema('IdInput')] },
			SkuInput: {
				type: 'object',
				required: ['skuCode', 'name', 'specifications', 'price'],
				properties: {
					skuCode: { type: 'string', maxLength: 80 },
					name: { type: 'string', maxLength: 191 },
					specifications: { type: 'object', additionalProperties: { type: 'string', maxLength: 100 } },
					price: money,
					marketPrice: { ...money, type: ['integer', 'null'] },
					isActive: { type: 'boolean', default: true },
					stock: { type: 'integer', minimum: 0, default: 0 },
				},
			},
			SkuCreateInput: {
				allOf: [schema('SkuInput'), { type: 'object', required: ['productId'], properties: { productId: id } }],
			},
			ProductInput: {
				type: 'object',
				required: ['categoryId', 'name', 'slug', 'skus'],
				properties: {
					categoryId: id,
					brandId: { ...id, type: ['string', 'null'] },
					name: { type: 'string', maxLength: 191 },
					subtitle: { type: ['string', 'null'], maxLength: 255 },
					slug: { type: 'string', maxLength: 191, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
					description: { type: ['string', 'null'] },
					sortOrder: { type: 'integer', default: 0 },
					images: { type: 'array', maxItems: 20, items: schema('ProductImageInput') },
					skus: { type: 'array', minItems: 1, maxItems: 100, items: schema('SkuInput') },
				},
			},
			ProductUpdateInput: {
				type: 'object',
				required: ['id'],
				minProperties: 2,
				properties: {
					id,
					categoryId: id,
					brandId: { ...id, type: ['string', 'null'] },
					name: { type: 'string', maxLength: 191 },
					subtitle: { type: ['string', 'null'], maxLength: 255 },
					slug: { type: 'string', maxLength: 191, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
					description: { type: ['string', 'null'] },
					sortOrder: { type: 'integer' },
					images: { type: 'array', maxItems: 20, items: schema('ProductImageInput') },
				},
				description: '至少传递一项；不在此接口修改 SKU。',
			},
			SkuUpdateInput: {
				type: 'object',
				required: ['id'],
				minProperties: 2,
				properties: {
					id,
					skuCode: { type: 'string', maxLength: 80 },
					name: { type: 'string', maxLength: 191 },
					specifications: { type: 'object', additionalProperties: { type: 'string', maxLength: 100 } },
					price: money,
					marketPrice: { ...money, type: ['integer', 'null'] },
					isActive: { type: 'boolean' },
				},
			},
			ProductImageInput: {
				type: 'object',
				required: ['url'],
				properties: {
					url: { type: 'string', format: 'uri' },
					alt: { type: ['string', 'null'], maxLength: 191 },
					sortOrder: { type: 'integer', default: 0 },
				},
			},
			ProductStatusInput: {
				type: 'object',
				required: ['id', 'status'],
				properties: { id, status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'INACTIVE'] } },
			},
			InventoryAdjustInput: {
				type: 'object',
				required: ['id', 'difference', 'remark'],
				properties: {
					id,
					difference: { type: 'integer', not: { const: 0 } },
					remark: { type: 'string', maxLength: 255 },
				},
			},
			OrderNoteInput: {
				type: 'object',
				required: ['id', 'content'],
				properties: { id, content: { type: 'string', maxLength: 500 } },
			},
			ReviewModerateInput: {
				type: 'object',
				required: ['id', 'status'],
				properties: { id, status: { type: 'string', enum: ['APPROVED', 'REJECTED'] } },
			},
			CouponInput: {
				type: 'object',
				required: ['code', 'name', 'discountAmount', 'totalQuantity', 'startsAt', 'endsAt'],
				properties: {
					code: { type: 'string', maxLength: 50, pattern: '^[A-Z0-9_-]+$' },
					name: { type: 'string', maxLength: 120 },
					scope: { type: 'string', enum: ['ALL', 'CATEGORY', 'PRODUCT'], default: 'ALL' },
					thresholdAmount: money,
					discountAmount: { ...money, minimum: 1 },
					totalQuantity: { type: 'integer', minimum: 1 },
					perUserLimit: { type: 'integer', minimum: 1, maximum: 100, default: 1 },
					startsAt: dateTime,
					endsAt: dateTime,
					isActive: { type: 'boolean', default: true },
					productIds: { type: 'array', maxItems: 500, items: id },
					categoryIds: { type: 'array', maxItems: 100, items: id },
				},
			},
			ShippingTemplateInput: {
				type: 'object',
				required: ['name', 'baseFee'],
				properties: {
					name: { type: 'string', maxLength: 100 },
					baseFee: money,
					freeThreshold: { ...money, type: ['integer', 'null'] },
					isDefault: { type: 'boolean', default: false },
					isActive: { type: 'boolean', default: true },
					regionRules: {
						type: 'array',
						maxItems: 100,
						items: {
							type: 'object',
							required: ['province', 'fee'],
							properties: { province: { type: 'string', maxLength: 80 }, fee: money },
						},
					},
				},
			},
			HomeBlockInput: {
				type: 'object',
				required: ['type', 'content'],
				properties: {
					type: { type: 'string', enum: ['BANNER', 'RECOMMENDATION', 'ANNOUNCEMENT'] },
					title: { type: ['string', 'null'], maxLength: 120 },
					content: { type: 'object', additionalProperties: true },
					sortOrder: { type: 'integer', default: 0 },
					isActive: { type: 'boolean', default: true },
					startsAt: { type: ['string', 'null'], format: 'date-time' },
					endsAt: { type: ['string', 'null'], format: 'date-time' },
				},
			},
			HomeBlockUpdateInput: { allOf: [schema('HomeBlockInput'), schema('IdInput')] },
			AfterSaleMockRefundInput: { allOf: [schema('IdempotencyInput'), schema('IdInput')] },
		},
	},
}
