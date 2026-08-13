# 性能基准与慢查询检查

## 运行方式

```bash
npm run test:performance
```

脚本仅允许使用 `express_shop_test` 数据库，会自动执行迁移并重建性能数据。默认生成 2000 个商品和 4000 个 SKU，在隔离的 `3100` 端口启动服务，以 25 并发持续请求 10 秒。

可通过环境变量调整规模和验收阈值：

```bash
PERF_PRODUCT_COUNT=10000 \
PERF_CONCURRENCY=50 \
PERF_DURATION_SECONDS=30 \
PERF_MAX_P95_MS=500 \
npm run test:performance
```

## 覆盖接口

- 商品列表首页
- 商品列表深分页
- 按分类筛选商品
- 分类列表
- 商品详情

验收标准为错误率等于 0 且 P95 不超过 `PERF_MAX_P95_MS`。本地基准仅用于发现回归，生产容量结论必须在与线上相近的 CPU、网络、MySQL 和 Redis 环境中重新测试。

## 查询计划

压测前会运行带 `FORCE INDEX` 的 `EXPLAIN`，确认以下复合索引对相应访问模式可用且不产生 filesort。实际生产环境仍由 MySQL 根据实时数据分布与统计信息自主选择执行计划：

- `Product(status, sortOrder, createdAt)`
- `Product(categoryId, status, sortOrder, createdAt)`
- `ProductSku(productId, isActive, price)`

本地首次基准结果：2000 个商品、4000 个 SKU、25 并发、10 秒，共完成 27332 次请求，吞吐量约 2732 req/s，P50 9.58ms，P95 12.77ms，P99 16.03ms，错误率 0。
