# 后端 API Backend

Nitro 服务端目录（`vite.config.ts` → `nitro.serverDir: "./api"`）。

```
api/
├── handlers/      # HTTP 业务处理（参数解析、响应组装）
├── api/           # Nitro 路由入口 → 对外 /api/*
├── routes/        # Nitro 根路由（如 /sitemap.xml）
└── middleware/    # 中间件（api.who.ga 子域等）
```

| 路径 | 说明 |
|------|------|
| `handlers/whois.ts` | 主查询逻辑 |
| `handlers/meta.ts` | `/api/meta` |
| `handlers/stats.ts` | `/api/stats` |
| `handlers/suffixes.ts` | `/api/suffixes` |
| `handlers/suffix-requests.ts` | `/api/suffix-requests` |
| `handlers/dns-lookup.ts` | `/api/dns_lookup` |
| `handlers/dns-reverse.ts` | `/api/dns_reverse` |
| `handlers/whoami.ts` | `/api/whoami` |
| `handlers/admin/refresh.ts` | `/api/admin/refresh` |
| `api/*.ts` | Nitro 薄封装，转发至 `handlers/` |
| `middleware/api-host.ts` | `api.who.ga` 子域路由 |

与 `lib/` 的区别：
- **`lib/`** — 可复用的纯业务模块
- **`api/handlers/`** — HTTP 层入口
