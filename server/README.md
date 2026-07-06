# 后端 · Nitro 路由入口 Backend Routes

Nitro 对外暴露的 HTTP 路由薄封装层，将请求转给 `src/server/api/` 中的业务处理函数。

| 路径 | API |
|------|-----|
| `api/whois.ts` | RDAP/WHOIS 主查询 |
| `api/meta.ts` | 数据元信息 |
| `api/stats.ts` | 查询统计 |
| `api/suffixes.ts` | 支持后缀列表 |
| `api/dns-lookup.ts` | DNS 正向查询 |
| `api/dns-reverse.ts` | DNS 反向查询 |
| `api/whoami.ts` | 客户端 IP |
| `api/admin/refresh.ts` | 数据同步刷新 |
| `middleware/api-host.ts` | `api.who.ga` 子域路由 |

配置见根目录 `vite.config.ts` 中 `nitro.serverDir`。
