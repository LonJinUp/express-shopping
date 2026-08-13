# 可观测性与告警

## 指标

设置 `METRICS_ENABLED=true` 和至少 32 位的 `METRICS_TOKEN` 后，Prometheus 可请求 `GET /metrics`：

```text
Authorization: Bearer <METRICS_TOKEN>
```

指标包括 Node.js 进程、HTTP 请求数与延迟、MySQL/Redis 可用性，以及后台巡检任务的成功和失败次数。HTTP 路由使用 Express 路由模板作为标签，不包含用户、订单号等高基数信息。

## 建议告警

- 5xx 比例在 5 分钟内超过 2%
- HTTP P95 延迟连续 10 分钟超过 1 秒
- `express_shop_dependency_up` 任何依赖连续 1 分钟为 0
- `express_shop_task_runs_total{result="failure"}` 15 分钟内增长
- 超时巡检任务超过 5 分钟没有成功完成
- `data-retention-cleanup` 超过 26 小时没有成功完成
- 支付单出现“主动查询已达最大次数”时立即告警

## 日志

Pino 输出 JSON 结构化日志，建议由容器平台收集到 Loki、Elasticsearch 或云日志服务。使用 `requestId`、`paymentId`、`channel` 和任务名关联查询；不应收集访问令牌、密码、支付密钥或完整个人信息。

生产环境应由网关或网络策略进一步限制 `/metrics` 的来源 IP，Bearer token 只是应用层的第二道保护。
