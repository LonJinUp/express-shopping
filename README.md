# Express Shop

Express Shop 是一个基于 Express 的电商商城后端项目。项目从单商户购物闭环逐步演进为多商户平台，现已覆盖商户入驻与数据隔离、跨店购物车、平台订单按店拆单，以及子订单独立支付、履约和售后。

## 项目目标

- 建立完整、可验证的商城交易闭环
- 保证订单、支付、库存和退款数据的一致性与可追踪性
- 提供用户端 API 和运营管理端 API
- 先完成单商户 MVP，再逐步补充营销、售后和数据能力
- 在不过度设计的前提下，为多商户、结算和佣金体系预留空间

## 核心业务流程

```text
注册/登录
  -> 浏览商品与选择 SKU
  -> 加入购物车或立即购买
  -> 确认地址、优惠和配送方式
  -> 创建订单并锁定库存
  -> 支付
  -> 商家发货
  -> 用户确认收货
  -> 评价/售后
  -> 订单完成
```

订单建议包含以下核心状态：

```text
PENDING_PAYMENT -> PAID -> PROCESSING -> SHIPPED -> COMPLETED
                -> CANCELLED
                -> AFTER_SALE -> REFUNDING -> REFUNDED
```

订单状态变更必须由明确的业务动作驱动，并记录操作日志。支付回调、取消订单、退款和库存恢复必须支持幂等处理。

## 功能范围

### 用户端

- 手机号或邮箱注册、登录、退出和令牌刷新
- 用户资料与收货地址管理
- 首页推荐、商品分类、搜索和筛选
- 商品详情、SKU 选择、价格及库存展示
- 购物车增删改选和失效商品处理
- 订单确认、金额计算、提交及取消
- 模拟支付，后续接入微信支付或支付宝
- 订单列表、详情及物流信息
- 确认收货、商品评价和追评
- 退款、退货退款及售后进度查询
- 商户售后处理、逾期提醒和平台介入仲裁
- 优惠券领取、查询和使用

### 管理端

- 管理员登录与角色权限控制
- 商品、SKU、分类、品牌和图片管理
- 商品上下架、库存调整和库存流水查询
- 订单查询、发货和备注
- 退款及售后审核
- 用户、评价和优惠券管理
- 首页轮播图、推荐位和基础商城配置
- 销售额、订单量、客单价及热销商品概览

### 多商户能力

- 商户和店铺入驻、审核及状态管理
- 商户后台及数据隔离
- OWNER/ADMIN/STAFF 成员权限、操作审计和数据导出
- 商户交易财务看板、平台资金负债总览和商户排行
- 跨店购物车结算、平台订单拆单和分店履约
- 平台佣金、不可变商户账本、周期结算及提现审核
- 店铺优惠、平台优惠及分摊规则
- 商户售后责任、逾期处理和平台仲裁

## 技术栈

### 后端

- **Node.js 22 LTS**：JavaScript 运行时
- **JavaScript（ES Modules）**：使用原生 `import` / `export` 组织代码
- **Express 5**：HTTP API 框架
- **MySQL 8**：用户、商品、SKU、库存、订单、支付和售后等核心数据
- **Prisma ORM**：数据库模型、迁移、事务和数据访问
- **Redis**：验证码、限流、短期缓存、分布式锁及异步任务状态
- **BullMQ**：订单超时关闭、自动确认收货等延迟任务
- **JWT**：访问令牌和刷新令牌认证
- **Zod**：请求参数和环境变量校验
- **Pino**：结构化日志
- **Swagger / OpenAPI**：接口文档

### 测试与工程化

- **Vitest**：单元测试和服务层测试
- **Supertest**：HTTP 接口集成测试
- **ESLint + Prettier**：代码检查与格式化
- **Husky + lint-staged**：提交前检查
- **Docker Compose**：本地启动 MySQL 和 Redis
- **GitHub Actions**：自动执行检查、测试和构建

### 文件与部署

- 开发环境可使用本地文件存储，生产环境使用兼容 S3 的对象存储
- 应用采用 Docker 镜像部署，Nginx 或云负载均衡负责 HTTPS 和反向代理
- 生产环境使用托管 MySQL、Redis 和对象存储，并配置备份与监控

## 推荐目录结构

```text
src/
  app.js                 # Express 应用装配
  server.js              # 服务启动和优雅退出
  config/                # 环境变量及基础配置
  constants/             # 状态、错误码等常量
  controllers/           # HTTP 输入输出适配
  services/              # 核心业务逻辑和事务
  repositories/          # 数据访问封装
  routes/                # 用户端和管理端路由
  middlewares/           # 认证、权限、异常、日志和限流
  validators/            # Zod 请求模型
  jobs/                  # 延迟任务和异步任务
  utils/                 # 通用工具
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
```

业务按领域拆分时，可以在上述目录下进一步划分 `auth`、`user`、`catalog`、`cart`、`order`、`inventory`、`payment`、`promotion`、`review` 和 `after-sale` 模块。

## 核心数据模型

- `User`、`UserAddress`、`Role`、`Permission`
- `Merchant`、`Shop`：单商户阶段保留默认记录，避免未来大规模改表
- `Category`、`Brand`、`Product`、`ProductSku`、`ProductImage`
- `Inventory`、`InventoryLog`
- `CartItem`
- `PlatformOrder`、`Order`、`OrderItem`、`OrderAddress`、`OrderLog`
- `Payment`、`PaymentCallbackLog`、`Refund`
- `Shipment`、`ShipmentTrack`
- `Coupon`、`CouponRule`、`UserCoupon`
- `Review`、`ReviewImage`
- `AfterSale`、`AfterSaleLog`

订单必须保存商品、SKU、价格、优惠和收货地址快照，避免商品或地址修改后影响历史订单。金额统一使用整数最小货币单位存储，例如人民币使用“分”，禁止使用浮点数计算金额。

## 关键设计约束

- 创建订单、库存锁定、优惠券核销等关联操作使用数据库事务
- 下单锁库存，订单超时或取消时释放；支付成功后转为正式扣减
- 支付和退款以服务端回调及主动查询结果为准
- 所有支付回调、退款请求和任务消费均通过业务唯一键保证幂等
- 数据库唯一索引用于约束订单号、支付流水号和回调流水号
- 管理端敏感操作记录操作人、时间、前后值和原因
- 用户端与管理端使用独立路由前缀和权限中间件
- 首期采用模块化单体，不提前拆分微服务

## API 约定

建议统一使用 `/api/v1` 版本前缀：

```text
/api/v1/auth/*           认证
/api/v1/products/*       商品目录
/api/v1/cart/*           购物车
/api/v1/orders/*         订单
/api/v1/platform-orders/* 平台订单
/api/v1/payments/*       支付
/api/v1/after-sales/*    售后
/api/v1/admin/*          管理端
```

项目接口只使用 `GET` 和 `POST`，接口路径不使用动态参数。查询使用 `GET`，参数统一放在 query；创建、修改、删除及状态变更统一使用 `POST`，参数统一放在 JSON body，并通过 `/create`、`/update`、`/delete`、`/cancel` 等固定动作路径明确语义。

```text
GET  /api/v1/products/detail?id=商品ID
POST /api/v1/orders/cancel  { "id": "订单ID", "reason": "不想要了" }
```

统一响应结构：

```json
{
	"code": "OK",
	"message": "success",
	"data": {},
	"requestId": "req_xxx"
}
```

业务异常应使用稳定错误码，不把内部错误栈、SQL 信息或第三方密钥返回给客户端。

## 开发计划

完整阶段、任务清单和验收标准见 [TODO.md](./TODO.md)。建议先完成阶段 0 和阶段 1，再开始并行开发用户端页面或管理端页面。

## 本地开发

环境要求：Node.js 22、MySQL 8 和 Redis 7。推荐安装 Docker Desktop 后启动本地依赖：

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

应用启动时会立即连接 MySQL 和 Redis。如出现 `P1001 Can't reach database server`，请先确认 `docker compose up -d` 已完成且 `docker compose ps` 中两个依赖均为 healthy。未创建 `.env` 时开发环境会使用 `.env.example` 中对应的本地默认地址。

当前 macOS 开发机已在 `~/.cache/express-shop-runtime` 安装项目专用的 MySQL 8.4 和 Redis 7.4。重启电脑后可使用：

```bash
npm run dev:services
npm run dev
```

需要更新迁移并重新执行 seed 时运行 `npm run dev:setup`；停止本地依赖运行 `npm run dev:services:stop`。

开发环境图片保存在 `uploads/images`。生产环境上线前应将上传实现替换为 S3、OSS 等对象存储，接口响应保持相同 URL 结构。

服务默认运行在 `http://localhost:3000`：

- 存活探针：`GET /health`
- 就绪探针：`GET /ready`
- API 入口：`GET /api/v1`
- OpenAPI 文档：`http://localhost:3000/docs`

当前接口路径与权限清单见 [docs/api.md](./docs/api.md)。

常用检查命令：

```bash
npm run validate
npm run test:integration
npm run test:performance
npm run db:reconcile
npm run db:backup
```

集成测试使用独立的 `express_shop_test` 数据库，执行迁移后覆盖认证、权限、商品库存、重复下单、并发防超卖、支付回调幂等、部分退款、退款重试和并发售后。测试脚本会拒绝清理任何非 `express_shop_test` 数据库，并可通过 `TEST_DATABASE_URL` 和 `TEST_DATABASE_ADMIN_URL` 覆盖默认连接。

## 容器部署

生产镜像使用 Node.js 22 Alpine 多阶段构建，并以非 root 用户运行。先由单独的发布步骤执行数据库迁移，再启动应用：

```bash
npm run db:deploy
docker compose -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` 适合单机预发布或小规模部署。正式生产环境应使用托管 MySQL、Redis 和对象存储，且不应在每个应用实例启动时自动执行 migration。`TASKS_ENABLED=false` 可关闭应用内定时巡检，便于在多实例环境中只为一个任务实例开启。

GitHub Actions 会在 PR 中验证 Docker 构建，主分支和版本标签推送到 GHCR。生产数据库迁移使用手动 `Database Migration` workflow，其 `production` environment 需配置 `DATABASE_URL` secret 和审批规则。

指标、日志和建议告警规则见 [docs/observability.md](./docs/observability.md)。
性能数据生成、压测参数和查询计划检查见 [docs/performance.md](./docs/performance.md)。
发布、备份恢复、应用回滚和支付退款对账步骤见 [docs/runbook.md](./docs/runbook.md)。
隐私与数据保留说明见 [docs/privacy-policy.md](./docs/privacy-policy.md)，用户协议草案见 [docs/terms-of-service.md](./docs/terms-of-service.md)。

## 当前状态

阶段 0 至阶段 3 的主要功能已完成；阶段 4 已具备售后申请、审核、退货入库、模拟退款、渠道退款单、失败重试、签名回调、超时提醒、金额与库存恢复的基础闭环。阶段 5 已完成容器与发布流水线、运行监控、优雅退出、渠道支付单及支付主动查询补偿框架，以及备份恢复、资金对账、性能基准和数据保留任务。阶段 6 的多商户升级已全部完成，包括商户入驻与成员权限、跨店结算与拆单、店铺独立履约和售后、平台仲裁、佣金账本、周期结算、提现审核、商户经营看板和平台总览。认证、权限、商品库存、订单幂等、并发防超卖、跨商户越权、支付回调、售后退款和财务一致性均已接入独立 MySQL 集成测试并纳入 CI。正式上线前仍需选定并接入真实支付渠道、外部消息通知和生产基础设施。
