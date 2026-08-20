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

## 站内通知

| 方法 | 路径                                 | 权限 | 说明                                   |
| ---- | ------------------------------------ | ---- | -------------------------------------- |
| GET  | `/api/v1/notifications`              | 登录 | 通知列表，支持分页和 `unreadOnly` 筛选 |
| GET  | `/api/v1/notifications/unread-count` | 登录 | 未读通知数量                           |
| POST | `/api/v1/notifications/read`         | 登录 | 标记一条通知已读，body 传 `id`         |
| POST | `/api/v1/notifications/read-all`     | 登录 | 将当前用户的全部通知标记为已读         |

支付成功、订单发货、退款成功和平台仲裁完成会在原业务事务内写入通知发件箱。定时任务异步投递站内通知，使用事件键防重并对失败任务进行指数退避重试。

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

结算商品可来自多个店铺，响应按 `shops` 分组并返回平台总金额。单店优惠券可继续传 `userCouponId`；跨店优惠券通过 `userCoupons: [{ shopId, userCouponId }]` 传递，每个店铺最多一张。

## 订单与支付

以下接口均需要登录。

| 方法 | 路径                              | 说明                        |
| ---- | --------------------------------- | --------------------------- |
| POST | `/api/v1/checkout/direct-preview` | 立即购买结算预览            |
| POST | `/api/v1/orders/create`           | 购物车或立即购买创建订单    |
| GET  | `/api/v1/orders`                  | 订单列表、状态筛选和分页    |
| GET  | `/api/v1/orders/detail`           | 订单详情，query 传 `id`     |
| GET  | `/api/v1/platform-orders`         | 平台订单列表与分页          |
| GET  | `/api/v1/platform-orders/detail`  | 平台订单及其子订单详情      |
| POST | `/api/v1/orders/cancel`           | 取消订单，body 传 `id`      |
| POST | `/api/v1/orders/confirm-receipt`  | 确认收货，body 传 `id`      |
| POST | `/api/v1/payments/mock-pay`       | 模拟支付并正式扣减锁定库存  |
| POST | `/api/v1/payments/create`         | 创建待渠道处理的支付单      |
| POST | `/api/v1/payments/callback`       | 支付回调，body 传 `channel` |
| POST | `/api/v1/reviews/create`          | 评价已完成订单中的商品      |

公开评价接口：`GET /api/v1/products/reviews`，query 传 `productId`。

购物车下单会创建一个平台订单，并按店铺生成多个可独立支付、履约和售后的子订单；立即购买仍直接返回单个店铺订单。平台订单状态在子订单状态不一致时返回 `MIXED`。

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

| 方法 | 路径                                        | 说明                             |
| ---- | ------------------------------------------- | -------------------------------- |
| GET  | `/api/v1/admin/home-blocks`                 | 首页配置列表                     |
| POST | `/api/v1/admin/home-blocks/create`          | 创建轮播、推荐或公告             |
| POST | `/api/v1/admin/home-blocks/update`          | 修改首页内容，body 传 `id`       |
| POST | `/api/v1/admin/home-blocks/delete`          | 删除首页内容，body 传 `id`       |
| GET  | `/api/v1/admin/analytics/dashboard`         | 销售、转化和热销商品统计         |
| GET  | `/api/v1/admin/analytics/platform-overview` | 多商户、交易、资金负债和待办总览 |
| GET  | `/api/v1/admin/orders/export`               | 导出最多 10000 条订单 CSV        |

## 售后与退款

| 方法 | 路径                                             | 权限  | 说明                         |
| ---- | ------------------------------------------------ | ----- | ---------------------------- |
| POST | `/api/v1/after-sales/create`                     | 登录  | 申请仅退款或退货退款         |
| GET  | `/api/v1/after-sales`                            | 登录  | 我的售后单列表               |
| GET  | `/api/v1/after-sales/detail`                     | 登录  | 售后详情，query 传 `id`      |
| POST | `/api/v1/after-sales/arbitration/request`        | 登录  | 对驳回或逾期售后申请平台介入 |
| POST | `/api/v1/after-sales/return-shipment`            | 登录  | 退货物流，body 传 `id`       |
| POST | `/api/v1/refunds/callback`                       | 公开  | 退款回调，body 传 `channel`  |
| GET  | `/api/v1/admin/after-sales`                      | ADMIN | 售后列表及待办数量           |
| GET  | `/api/v1/admin/after-sales/detail`               | ADMIN | 售后详情，query 传 `id`      |
| GET  | `/api/v1/admin/after-sales/arbitrations`         | ADMIN | 平台仲裁列表                 |
| POST | `/api/v1/admin/after-sales/arbitrations/resolve` | ADMIN | 仲裁批准或驳回               |
| POST | `/api/v1/admin/after-sales/review`               | ADMIN | 审核，body 传 `id`           |
| POST | `/api/v1/admin/after-sales/confirm-return`       | ADMIN | 确认退货，body 传 `id`       |
| POST | `/api/v1/admin/after-sales/refund`               | ADMIN | 创建退款，body 传 `id`       |
| POST | `/api/v1/admin/after-sales/retry-refund`         | ADMIN | 重试退款，body 传 `id`       |
| POST | `/api/v1/admin/after-sales/mock-refund`          | ADMIN | 模拟退款，body 传 `id`       |

退款金额由服务端按订单项实付金额和数量比例计算。未退完全部商品时不退运费；一次或分批退完全部商品时，在最后一笔退还运费。全额退款时，未过期优惠券恢复为可用，已过期则标记过期。

创建渠道退款单后状态为 `PENDING`，渠道适配器应使用返回的 `refundNo`、`amount` 和 `channel` 发起退款。渠道回调失败后可调用重试接口，服务端保留原退款单并累计 `retryCount`。

## 商户入驻与管理

| 方法 | 路径                                         | 权限        | 参数位置 | 说明                                         |
| ---- | -------------------------------------------- | ----------- | -------- | -------------------------------------------- |
| POST | `/api/v1/merchant-applications/create`       | 登录用户    | body     | 提交商户入驻申请，`clientRequestId` 保证幂等 |
| GET  | `/api/v1/merchant-applications/mine`         | 登录用户    | query    | 查询自己的入驻申请                           |
| GET  | `/api/v1/merchant/shops`                     | 商户成员    | query    | 查询有权访问的商户与店铺                     |
| POST | `/api/v1/merchant/shops/update`              | OWNER/ADMIN | body     | 修改所属店铺资料                             |
| GET  | `/api/v1/merchant/members`                   | 商户成员    | query    | 商户成员列表                                 |
| POST | `/api/v1/merchant/members/add`               | OWNER/ADMIN | body     | 按邮箱或手机号添加成员                       |
| POST | `/api/v1/merchant/members/update`            | OWNER/ADMIN | body     | 调整角色或停用成员                           |
| GET  | `/api/v1/merchant/audit-logs`                | 商户成员    | query    | 商户写操作审计日志                           |
| GET  | `/api/v1/admin/merchant-applications`        | ADMIN       | query    | 分页查询入驻申请                             |
| POST | `/api/v1/admin/merchant-applications/review` | ADMIN       | body     | 通过或驳回入驻申请                           |

商户商品和订单接口均要求传递 `shopId`。GET 请求放在 query，POST 请求放在 body；平台会校验当前用户是否属于该店铺。OWNER 和 ADMIN 可执行写操作，STAFF 仅可查询。

| 方法 | 路径                                     | 权限        | 参数位置 | 说明                  |
| ---- | ---------------------------------------- | ----------- | -------- | --------------------- |
| GET  | `/api/v1/merchant/products`              | 商户成员    | query    | 当前店铺商品列表      |
| GET  | `/api/v1/merchant/products/detail`       | 商户成员    | query    | 当前店铺商品详情      |
| POST | `/api/v1/merchant/products/create`       | OWNER/ADMIN | body     | 创建商品及 SKU        |
| POST | `/api/v1/merchant/products/update`       | OWNER/ADMIN | body     | 修改当前店铺商品      |
| POST | `/api/v1/merchant/products/status`       | OWNER/ADMIN | body     | 修改商品状态          |
| POST | `/api/v1/merchant/products/delete`       | OWNER/ADMIN | body     | 软删除商品            |
| POST | `/api/v1/merchant/skus/create`           | OWNER/ADMIN | body     | 创建 SKU              |
| POST | `/api/v1/merchant/skus/update`           | OWNER/ADMIN | body     | 修改 SKU              |
| POST | `/api/v1/merchant/skus/inventory/adjust` | OWNER/ADMIN | body     | 调整当前店铺 SKU 库存 |
| GET  | `/api/v1/merchant/orders`                | 商户成员    | query    | 当前店铺订单列表      |
| GET  | `/api/v1/merchant/orders/detail`         | 商户成员    | query    | 当前店铺订单详情      |
| POST | `/api/v1/merchant/orders/accept`         | OWNER/ADMIN | body     | 接单                  |
| POST | `/api/v1/merchant/orders/ship`           | OWNER/ADMIN | body     | 发货                  |
| POST | `/api/v1/merchant/orders/notes/create`   | OWNER/ADMIN | body     | 添加店铺内部订单备注  |

| 方法 | 路径                                          | 权限        | 参数位置 | 说明                 |
| ---- | --------------------------------------------- | ----------- | -------- | -------------------- |
| GET  | `/api/v1/merchant/coupons`                    | 商户成员    | query    | 当前店铺优惠券列表   |
| POST | `/api/v1/merchant/coupons/create`             | OWNER/ADMIN | body     | 创建店铺优惠券       |
| GET  | `/api/v1/merchant/shipping-templates`         | 商户成员    | query    | 当前店铺运费模板     |
| POST | `/api/v1/merchant/shipping-templates/create`  | OWNER/ADMIN | body     | 创建店铺运费模板     |
| GET  | `/api/v1/merchant/after-sales`                | 商户成员    | query    | 当前店铺售后列表     |
| GET  | `/api/v1/merchant/after-sales/detail`         | 商户成员    | query    | 当前店铺售后详情     |
| POST | `/api/v1/merchant/after-sales/review`         | OWNER/ADMIN | body     | 审核售后             |
| POST | `/api/v1/merchant/after-sales/confirm-return` | OWNER/ADMIN | body     | 确认收到退货         |
| POST | `/api/v1/merchant/after-sales/refund`         | OWNER/ADMIN | body     | 创建渠道退款单       |
| POST | `/api/v1/merchant/after-sales/retry-refund`   | OWNER/ADMIN | body     | 重试退款             |
| POST | `/api/v1/merchant/after-sales/mock-refund`    | OWNER/ADMIN | body     | 开发环境模拟退款     |
| GET  | `/api/v1/merchant/analytics/dashboard`        | 商户成员    | query    | 当前店铺经营看板     |
| GET  | `/api/v1/merchant/orders/export`              | OWNER/ADMIN | query    | 导出当前店铺订单 CSV |

### 商户财务

| 方法 | 路径                                          | 权限        | 说明                           |
| ---- | --------------------------------------------- | ----------- | ------------------------------ |
| GET  | `/api/v1/merchant/finance/account`            | 商户成员    | 待结算、可用、冻结和已提现余额 |
| GET  | `/api/v1/merchant/finance/ledger`             | 商户成员    | 支付、退款、结算和提现流水     |
| GET  | `/api/v1/merchant/finance/ledger/export`      | OWNER/ADMIN | 导出当前店铺资金流水 CSV       |
| POST | `/api/v1/merchant/finance/settlements/create` | OWNER/ADMIN | 按订单完成周期生成结算单       |
| GET  | `/api/v1/merchant/finance/settlements`        | 商户成员    | 结算单及订单明细               |
| POST | `/api/v1/merchant/finance/withdrawals/create` | OWNER/ADMIN | 从可用余额申请提现             |
| GET  | `/api/v1/merchant/finance/withdrawals`        | 商户成员    | 提现记录                       |
| GET  | `/api/v1/admin/finance/withdrawals`           | ADMIN       | 平台提现审核列表               |
| POST | `/api/v1/admin/finance/withdrawals/review`    | ADMIN       | 批准、驳回或完成打款           |
| POST | `/api/v1/admin/shops/commission/update`       | ADMIN       | 设置店铺佣金万分比             |

金额统一使用“分”，`commissionRateBps` 使用万分比，例如 `500` 表示 5%。支付成功后商户净收入进入待结算余额；只有已完成订单可以生成结算单并转入可用余额。提现申请会冻结可用余额，平台驳回时原路恢复，完成打款后计入累计提现。

成员权限规则：OWNER 可以管理 ADMIN 和 STAFF；ADMIN 只能添加、调整或停用 STAFF；OWNER 不能通过普通成员接口被修改。商户写接口会异步记录操作者、店铺、请求参数、结果状态和请求 ID，银行卡号等敏感字段在审计载荷中会被脱敏。

商户经营看板同时返回订单转化指标和财务指标，包括支付收入、退款、佣金、商户净收入、账户余额、结算金额及提现状态。平台总览按相同时间范围汇总商户与店铺数量、平台订单、实付与退款、平台佣金、商户资金负债、待处理任务和商户净收入排行。
