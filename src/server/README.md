# 后端 · API 业务处理 Backend Handlers

API 实际业务逻辑，由 `server/api/` 的 Nitro 路由调用。

与 `lib/` 的区别：
- **`lib/`** — 可复用的纯业务模块
- **`src/server/api/`** — HTTP 请求处理、参数解析、响应组装

| 文件 | 端点 |
|------|------|
| `whois.ts` | 主查询 |
| `meta.ts` | `/api/meta` |
| `stats.ts` | `/api/stats` |
| `suffixes.ts` | `/api/suffixes` |
| `dns-lookup.ts` | `/api/dns_lookup` |
| `dns-reverse.ts` | `/api/dns_reverse` |
| `whoami.ts` | `/api/whoami` |
| `admin/refresh.ts` | `/api/admin/refresh` |
