# 后端 · 核心业务 Backend Core

与框架无关的查询、缓存、数据同步逻辑，被 `api/handlers/` 引用。

| 文件 | 说明 |
|------|------|
| `domain.ts` | 域名/后缀校验与规范化 |
| `rdap-registry.ts` | RDAP 服务发现与路由 |
| `whois-data-sync.ts` | IANA/ICANN 数据拉取与合并 |
| `whois-fallback.ts` | 无 RDAP 时的 WHOIS port43 回退 |
| `whois-external-fallback.ts` | 外部 API 回退（ipinfo 等） |
| `cache.ts` | Redis / 内存缓存 |
| `query-stats.ts` | 查询统计持久化 |
| `runtime-data.ts` | 种子数据 vs 运行时数据路径解析 |
| `types.ts` | 共享类型定义 |
