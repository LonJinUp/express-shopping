# API 清单

所有接口以 `/api/v1` 开头，只使用 `GET`、`POST`。接口路径不使用动态参数：`GET` 参数通过 query 传递，`POST` 参数通过 JSON body 传递。需要登录的接口通过 `Authorization: Bearer <accessToken>` 传递访问令牌。

## 基础与认证

| 方法 | 路径                           | 权限 | 说明                   |
| ---- | ------------------------------ | ---- | ---------------------- |
| GET  | `/health`                      | 公开 | 存活检查               |
| GET  | `/ready`                       | 公开 | MySQL、Redis 就绪检查  |
| POST | `/api/v1/auth/register`        | 公开 | 注册用户               |
| POST | `/api/v1/auth/login`           | 公开 | 邮箱或手机号登录       |
| POST | `/api/v1/auth/refresh`         | 公开 | 轮换刷新令牌           |
| POST | `/api/v1/auth/logout`          | 登录 | 撤销当前会话           |
| POST | `/api/v1/auth/forgot-password` | 公开 | 申请一次性密码重置令牌 |
| POST | `/api/v1/auth/reset-password`  | 公开 | 重置密码并撤销全部会话 |

## 用户

| 方法 | 路径                       | 权限 | 说明                   |
| ---- | -------------------------- | ---- | ---------------------- |
| GET  | `/api/v1/profile`          | 登录 | 获取个人资料           |
| POST | `/api/v1/profile/update`   | 登录 | 修改个人资料           |
| GET  | `/api/v1/addresses`        | 登录 | 地址列表               |
| POST | `/api/v1/addresses/create` | 登录 | 新增地址               |
| POST | `/api/v1/addresses/update` | 登录 | 修改地址，body 传 `id` |
| POST | `/api/v1/addresses/delete` | 登录 | 删除地址，body 传 `id` |

## 商城目录

| 方法 | 路径                      | 权限 | 说明                                |
| ---- | ------------------------- | ---- | ----------------------------------- |
| GET  | `/api/v1/categories`      | 公开 | 分类列表                            |
| GET  | `/api/v1/brands`          | 公开 | 品牌列表                            |
| GET  | `/api/v1/products`        | 公开 | 上架商品搜索、筛选和分页            |
| GET  | `/api/v1/products/detail` | 公开 | 商品、SKU 和库存详情，query 传 `id` |

## 商品管理

以下接口均需要 `ADMIN` 角色。

| 方法 | 路径                                  | 说明                          |
| ---- | ------------------------------------- | ----------------------------- |
| POST | `/api/v1/admin/categories/create`     | 新增分类                      |
| POST | `/api/v1/admin/categories/update`     | 修改分类，body 传 `id`        |
| POST | `/api/v1/admin/brands/create`         | 新增品牌                      |
| POST | `/api/v1/admin/brands/update`         | 修改品牌，body 传 `id`        |
| GET  | `/api/v1/admin/products`              | 管理端商品列表                |
| GET  | `/api/v1/admin/products/detail`       | 管理端商品详情，query 传 `id` |
| POST | `/api/v1/admin/products/create`       | 新增商品及 SKU                |
| POST | `/api/v1/admin/products/update`       | 修改商品及图片，body 传 `id`  |
| POST | `/api/v1/admin/products/status`       | 修改商品状态，body 传 `id`    |
| POST | `/api/v1/admin/products/delete`       | 软删除商品，body 传 `id`      |
| POST | `/api/v1/admin/skus/create`           | 新增 SKU，body 传 `productId` |
| POST | `/api/v1/admin/skus/update`           | 修改 SKU，body 传 `id`        |
| POST | `/api/v1/admin/skus/inventory/adjust` | 调整库存，body 传 `id`        |
| POST | `/api/v1/admin/uploads/images`        | 上传商品图片                  |

## 购物车与结算

以下接口均需要登录。

| 方法 | 路径                        | 说明                         |
| ---- | --------------------------- | ---------------------------- |
| GET  | `/api/v1/cart`              | 获取购物车                   |
| POST | `/api/v1/cart/items/add`    | 加入购物车                   |
| POST | `/api/v1/cart/items/update` | 修改数量或勾选，body 传 `id` |
| POST | `/api/v1/cart/items/delete` | 删除购物车商品，body 传 `id` |
| POST | `/api/v1/cart/items/select` | 批量修改勾选状态             |
| POST | `/api/v1/checkout/preview`  | 结算预览与计价               |

## 订单与支付

以下接口均需要登录。

| 方法 | 路径                              | 说明                        |
| ---- | --------------------------------- | --------------------------- |
| POST | `/api/v1/checkout/direct-preview` | 立即购买结算预览            |
| POST | `/api/v1/orders/create`           | 购物车或立即购买创建订单    |
| GET  | `/api/v1/orders`                  | 订单列表、状态筛选和分页    |
| GET  | `/api/v1/orders/detail`           | 订单详情，query 传 `id`     |
| POST | `/api/v1/orders/cancel`           | 取消订单，body 传 `id`      |
| POST | `/api/v1/orders/confirm-receipt`  | 确认收货，body 传 `id`      |
| POST | `/api/v1/payments/mock-pay`       | 模拟支付并正式扣减锁定库存  |
| POST | `/api/v1/payments/create`         | 创建待渠道处理的支付单      |
| POST | `/api/v1/payments/callback`       | 支付回调，body 传 `channel` |
| POST | `/api/v1/reviews/create`          | 评价已完成订单中的商品      |

公开评价接口：`GET /api/v1/products/reviews`，query 传 `productId`。

支付和退款回调需传递 `x-payment-timestamp` 和 `x-payment-signature`。签名内容为 `<timestamp>.<rawBody>`，使用 `PAYMENT_CALLBACK_SECRET` 计算 HMAC-SHA256 十六进制摘要。请求时间超过配置窗口将被拒绝；密钥轮换期间可临时配置 `PAYMENT_CALLBACK_PREVIOUS_SECRET`。

## 订单管理

以下接口均需要 `ADMIN` 角色。

| 方法 | 路径                                | 说明                    |
| ---- | ----------------------------------- | ----------------------- |
| GET  | `/api/v1/admin/orders`              | 管理端订单列表          |
| GET  | `/api/v1/admin/orders/detail`       | 订单详情，query 传 `id` |
| POST | `/api/v1/admin/orders/accept`       | 商家接单，body 传 `id`  |
| POST | `/api/v1/admin/orders/ship`         | 发货，body 传 `id`      |
| POST | `/api/v1/admin/orders/notes/create` | 添加备注，body 传 `id`  |
| GET  | `/api/v1/admin/reviews`             | 评价审核列表            |
| POST | `/api/v1/admin/reviews/moderate`    | 审核评价，body 传 `id`  |

## 优惠券与运费

| 方法 | 路径                                      | 权限  | 说明                     |
| ---- | ----------------------------------------- | ----- | ------------------------ |
| GET  | `/api/v1/coupons`                         | 公开  | 当前可领取优惠券         |
| GET  | `/api/v1/user-coupons`                    | 登录  | 我的优惠券               |
| POST | `/api/v1/coupons/claim`                   | 登录  | 领取优惠券，body 传 `id` |
| POST | `/api/v1/admin/coupons/create`            | ADMIN | 创建优惠券模板           |
| POST | `/api/v1/admin/shipping-templates/create` | ADMIN | 创建默认运费及地区规则   |

购物车结算预览、立即购买预览和创建订单均支持可选的 `userCouponId`。结算预览还需要 `addressId`，服务端根据收货省份计算运费。

## 首页与用户互动

| 方法 | 路径                             | 权限 | 说明                   |
| ---- | -------------------------------- | ---- | ---------------------- |
| GET  | `/api/v1/home`                   | 公开 | 首页内容块             |
| GET  | `/api/v1/favorites`              | 登录 | 收藏列表               |
| POST | `/api/v1/products/favorite`      | 登录 | 收藏商品，body 传 `id` |
| POST | `/api/v1/products/unfavorite`    | 登录 | 取消收藏，body 传 `id` |
| GET  | `/api/v1/browsing-history`       | 登录 | 最近 100 条足迹        |
| POST | `/api/v1/products/view`          | 登录 | 记录足迹，body 传 `id` |
| POST | `/api/v1/browsing-history/clear` | 登录 | 清空浏览历史           |
| POST | `/api/v1/orders/buy-again`       | 登录 | 再次购买，body 传 `id` |

## 运营管理

以下接口均需要 `ADMIN` 角色。

| 方法 | 路径                                | 说明                       |
| ---- | ----------------------------------- | -------------------------- |
| GET  | `/api/v1/admin/home-blocks`         | 首页配置列表               |
| POST | `/api/v1/admin/home-blocks/create`  | 创建轮播、推荐或公告       |
| POST | `/api/v1/admin/home-blocks/update`  | 修改首页内容，body 传 `id` |
| POST | `/api/v1/admin/home-blocks/delete`  | 删除首页内容，body 传 `id` |
| GET  | `/api/v1/admin/analytics/dashboard` | 销售、转化和热销商品统计   |
| GET  | `/api/v1/admin/orders/export`       | 导出最多 10000 条订单 CSV  |

## 售后与退款

| 方法 | 路径                                       | 权限  | 说明                        |
| ---- | ------------------------------------------ | ----- | --------------------------- |
| POST | `/api/v1/after-sales/create`               | 登录  | 申请仅退款或退货退款        |
| GET  | `/api/v1/after-sales`                      | 登录  | 我的售后单列表              |
| GET  | `/api/v1/after-sales/detail`               | 登录  | 售后详情，query 传 `id`     |
| POST | `/api/v1/after-sales/return-shipment`      | 登录  | 退货物流，body 传 `id`      |
| POST | `/api/v1/refunds/callback`                 | 公开  | 退款回调，body 传 `channel` |
| GET  | `/api/v1/admin/after-sales`                | ADMIN | 售后列表及待办数量          |
| GET  | `/api/v1/admin/after-sales/detail`         | ADMIN | 售后详情，query 传 `id`     |
| POST | `/api/v1/admin/after-sales/review`         | ADMIN | 审核，body 传 `id`          |
| POST | `/api/v1/admin/after-sales/confirm-return` | ADMIN | 确认退货，body 传 `id`      |
| POST | `/api/v1/admin/after-sales/refund`         | ADMIN | 创建退款，body 传 `id`      |
| POST | `/api/v1/admin/after-sales/retry-refund`   | ADMIN | 重试退款，body 传 `id`      |
| POST | `/api/v1/admin/after-sales/mock-refund`    | ADMIN | 模拟退款，body 传 `id`      |

退款金额由服务端按订单项实付金额和数量比例计算。未退完全部商品时不退运费；一次或分批退完全部商品时，在最后一笔退还运费。全额退款时，未过期优惠券恢复为可用，已过期则标记过期。

创建渠道退款单后状态为 `PENDING`，渠道适配器应使用返回的 `refundNo`、`amount` 和 `channel` 发起退款。渠道回调失败后可调用重试接口，服务端保留原退款单并累计 `retryCount`。
