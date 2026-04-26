# WHO.GA

WHO.GA 是一个基于 Next.js 16 + TypeScript 的 RDAP / WHOIS 查询站，提供网页查询体验与可直接集成的 JSON API。

- 线上首页: `https://who.ga`
- API 子域名: `https://api.who.ga`

## 功能概览

- 查询域名、后缀、IP、ASN 的结构化 RDAP 数据
- 首页与 API 共用同一套查询链路
- `api.who.ga/<query>` 直接返回标准化 JSON
- `api.who.ga/` 自动跳转到首页
- API 会清洗上游 RDAP/WHOIS 响应中的 HTML 空格与异常空白字符，避免过期时间等字段显示脏数据
- 支持大量 TLD 与 IDN 国际化后缀
- 首页内置请求图表、API 示例、FAQ、支持后缀展示
- 支持 Redis 缓存与本地持久化统计
- 支持数据可用性测试与 TLD/RDAP 扫描脚本

## 本地开发

```bash
pnpm install
pnpm dev
```

默认启动后访问 `http://localhost:3000`。

生产构建:

```bash
pnpm build
pnpm start
```

## API 用法

推荐直接使用 API 子域名:

```bash
curl https://api.who.ga/google.tt
curl https://api.who.ga/8.8.8.8
curl https://api.who.ga/AS15169
curl https://api.who.ga/.com
```

说明:

- `https://api.who.ga/` 会跳转到 `https://who.ga/`
- `https://api.who.ga/<query>` 会返回 JSON
- `<query>` 可以是域名、后缀、IP 或 ASN
- 域名查询会优先返回注册商 RDAP 数据；如果注册商数据不可用，则回退到注册局或 IANA RDAP 数据

兼容查询接口:

```bash
curl "https://who.ga/api/whois?domain=google.tt"
```

## 统计与持久化

站点内置一套查询统计系统，首页图表与统计卡片都来自统一接口。

- 真实用户请求会实时写入统计
- 系统会按小时为当天生成基础增量，用于维持连续的日活趋势
- 每天从 0 开始累计，次日重新开始
- 最近 30 天的数据会持久化保存
- 首页图表当前展示最近 21 天

默认持久化文件位置:

```text
../whoga-runtime/query-stats.json
```

可通过环境变量覆盖:

- `QUERY_STATS_DIR`

## 环境变量

- `CRON_SECRET`: 保护 `/api/admin/refresh`
- `REDIS_URL`: Redis 连接串
- `WHOIS_CACHE_TTL_SECONDS`: 查询缓存 TTL，默认 900 秒
- `RDAP_EXTRA_SOURCE_URL`: 额外 RDAP 源地址
- `QUERY_STATS_DIR`: 查询统计持久化目录

## 数据文件

项目依赖 IANA RDAP Bootstrap 与本地派生数据文件，主要包括:

- `data/dns.json`
- `data/whois-merged.json`
- `data/update-meta.json`
- `data/tlds.json`
- `data/tld-categories.json`
- `data/public_suffix_list.dat`

## 数据与测试脚本

```bash
pnpm audit:data
pnpm audit:data:strict
pnpm check:tlds-queryability
pnpm test:rdap-all
pnpm test:data-availability
```

这些脚本会生成对应的报告文件，例如:

- `data/rdap-domain-test-report.json`
- `data/data-availability-report.json`

## 部署说明

当前项目已部署在自建服务器上，通过 PM2 运行。

典型部署流程:

```bash
pnpm install --frozen-lockfile
pnpm build
pm2 restart whoga
```

如果使用反向代理，请确保:

- `who.ga` 指向 Next.js 首页
- `api.who.ga` 指向同一应用
- 根路径访问 `api.who.ga` 时跳转首页
- 路径形式 `api.who.ga/<query>` 可通过 Next.js `proxy.ts` 重写到 `/api/whois`

## 技术栈

- Next.js 16.2.4
- React 19
- TypeScript
- ioredis

## 仓库说明

这个仓库同时包含:

- 前端首页与结果页
- API 路由
- RDAP 数据同步与派生逻辑
- 查询统计与图表数据
- 本地测试与审计脚本
