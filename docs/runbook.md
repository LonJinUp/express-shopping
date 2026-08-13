# 发布、备份、恢复与对账手册

## 目标

- 建议数据库 RPO 不超过 24 小时，生产环境应结合云数据库日志实现分钟级时间点恢复。
- 建议应用 RTO 不超过 30 分钟，数据库恢复 RTO 不超过 2 小时。
- 每次发布前必须完成数据库备份、迁移检查和回归测试。
- 每日执行支付退款一致性检查，发现问题时只告警，不自动修改资金数据。

## 发布前检查

```bash
npm ci
npm run validate
npm run test:integration
npm run db:backup
npm run db:reconcile
```

确认备份目录同时包含 `.sql.gz` 与 `.sql.gz.sha256`。生产备份应复制到独立账号的对象存储，并配置服务端加密、版本控制和保留策略，不能只保存在数据库所在主机。

推荐保留：每日备份 14 天、每周备份 8 周、每月备份 12 个月。至少每季度将备份恢复到隔离数据库并完成一次演练。

## 数据库迁移

1. 优先使用向前兼容的扩展迁移：先新增字段或表，再发布兼容新旧结构的应用。
2. 执行 `npm run db:backup`。
3. 通过受审批的 `Database Migration` workflow 执行 `prisma migrate deploy`。
4. 验证 `/ready`、核心接口和 `npm run db:reconcile`。
5. 删除字段、缩窄类型等破坏性变更应延迟到后续独立版本。

Prisma migration 不应在生产环境使用 `migrate reset`。MySQL DDL 可能隐式提交，失败时先停止继续发布，检查实际表结构，再决定修复 migration 或使用 `prisma migrate resolve`；不可盲目标记成功。

## 应用回滚

应用镜像同时发布版本标签和 commit SHA。回滚时将部署镜像固定到上一个已验证 SHA，保持数据库不回退，并确认旧应用仍兼容已执行的扩展迁移。

```bash
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app
curl --fail http://127.0.0.1:3000/ready
```

若 migration 含破坏性变更且旧应用不兼容，停止写流量后从发布前备份恢复，不能仅回滚镜像。

## 备份与恢复

创建带 SHA-256 校验和的压缩备份：

```bash
BACKUP_DIR=/secure/backups npm run db:backup
```

恢复必须先在隔离环境验证：

```bash
DATABASE_URL=mysql://user:password@host:3306/express_shop_restore_test \
BACKUP_FILE=/secure/backups/express_shop-时间.sql.gz \
CONFIRM_RESTORE=express_shop_restore_test \
npm run db:restore

DATABASE_URL=mysql://user:password@host:3306/express_shop_restore_test npm run db:reconcile
```

生产恢复额外要求 `ALLOW_PRODUCTION_RESTORE=true`，并且 `CONFIRM_RESTORE` 必须与目标数据库名完全一致。恢复前应停止所有写入实例和后台任务，恢复后执行 migration 状态检查、对账和抽样订单核验，再逐步恢复流量。

## 支付退款对账

```bash
npm run db:reconcile
```

检查订单退款金额、成功支付金额、订单状态、累计退款与成功退款单之和，以及退款单和售后单状态是否一致。命令发现异常时返回非零退出码并输出最多 20 条样本。

处理时先核对支付渠道账单，再通过补偿任务或经审批的人工脚本修复；不要直接在生产库临时修改金额字段。

## 故障分级

- P0：重复扣款、超额退款、数据丢失。立即关闭相关写入口，保留日志和渠道流水，启动人工对账。
- P1：支付回调积压、数据库不可用、订单大面积失败。停止发布，切换降级或回滚应用。
- P2：单个订单状态不一致、报表延迟。记录工单并在一个工作日内完成核对和补偿。

事故结束后保留时间线、影响订单、根因、修复 SQL 或脚本、验证结果和预防措施。
