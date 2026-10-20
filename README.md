<div align="center">

<img src="./public/logo.svg" width="88" alt="Whoga" />

# Whoga

**自托管的域名 / IP / ASN 查询平台 — RDAP 优先,WHOIS 回退**

<a href="./README.en.md">English</a> · <strong>中文</strong>

<a href="https://who.ga">who.ga</a> · <a href="https://api.who.ga">api.who.ga</a> · <a href="https://who.ga/learn">技术指南</a> · <a href="https://github.com/gentpan/whoga/issues">Issues</a>

<img src="https://img.shields.io/github/stars/gentpan/whoga?style=flat-square" alt="GitHub stars" />
<img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" />
<img src="https://img.shields.io/badge/node-20+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 20+" />
<img src="https://img.shields.io/badge/TypeScript-全栈-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />

</div>

<br />

<table>
  <tr>
    <td><img src="./docs/screenshots/theme-light.png" alt="浅色主题" /></td>
    <td><img src="./docs/screenshots/theme-dark.png" alt="深色主题" /></td>
    <td><img src="./docs/screenshots/theme-terminal.png" alt="终端主题" /></td>
  </tr>
  <tr>
    <td align="center">浅色</td>
    <td align="center">深色</td>
    <td align="center">终端</td>
  </tr>
</table>

## 这是什么

输入一个域名、IP 或 ASN,一次返回注册局与注册商的结构化数据。RDAP 优先;查不到时自动回退 WHOIS port43(主机探测 + IANA 转介跟随),再走第三方 HTTP WHOIS API。覆盖 IANA 根区 **95%+** 的后缀(1,380+),数据每日与 IANA 同步。

界面三套主题一键切换(浅色 / 深色 / 终端),超椭圆(squircle)圆角,中英双语。同时提供公开 JSON API,自托管只需一个进程。

## 快速开始

```bash
git clone https://github.com/gentpan/whoga.git
cd whoga
pnpm install
pnpm dev          # http://localhost:3410
```

生产环境:

```bash
pnpm build && pnpm start
```

## API

```bash
curl "http://localhost:3410/api/whois?domain=google.com"
curl "http://localhost:3410/api/whois?domain=8.8.8.8"
curl "http://localhost:3410/api/whois?domain=AS15169"
```

线上版支持路径式调用:[api.who.ga/google.com](https://api.who.ga/google.com)

## 技术栈

**后端不是 Go,也没有独立后端** — 单仓 TypeScript 全栈应用,网页和 JSON API 跑在同一个 Node.js 进程里,一次构建、一次部署。

| 部分 | 说明 |
|------|------|
| 语言 | TypeScript(前后端统一) |
| 运行 | Node.js 20+ · pnpm |
| 框架 | TanStack Start(SSR)+ Nitro(服务端) |
| 前端 | React 19 · Vite · TanStack Router(文件式路由) |
| 交互 | Base UI · Lucide 图标 |
| 样式 | 原生 CSS 变量 + 主题系统 · `corner-shape: squircle`(自动降级) |
| API | 同仓库 `api/` 的 Nitro handler |
| 缓存 | Redis(可选) |

## 配置

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `CRON_SECRET` | 刷新接口密钥(生产建议设置) |
| `REDIS_URL` | Redis 缓存 |
| `WHOIS_CACHE_TTL_SECONDS` | 缓存时间,默认 900 |

## 数据

`data/`(种子)→ `runtime/data/`(运行时,优先读取)。刷新:

```bash
pnpm refresh:data               # 全量刷新(也可 POST /api/admin/refresh)
pnpm sync:rdap-extra            # 重新生成补充 RDAP 映射
pnpm scan:whois-hosts           # 探测无 RDAP 后缀的 WHOIS 主机
pnpm test:rdap-all              # 实测所有后缀 RDAP 端点活性
pnpm check:tlds-queryability    # 后缀可查询率报告
```

## 项目结构

```
whoga/
├── web/           # 前端:routes/ 路由 · components/ 组件 · lib/ 文案与逻辑
├── api/           # HTTP API handler(/api/whois、/api/stats 等)
├── lib/           # 共享业务逻辑(RDAP/WHOIS、数据索引、回退链)
├── data/          # 种子数据(RDAP 映射、TLD 清单)
├── runtime/       # 运行时数据(gitignore,优先读取)
├── scripts/       # 数据刷新与运维脚本
├── deploy/        # 部署脚本(见 deploy/README.md)
└── docs/          # 截图等文档资源
```

## 部署

```bash
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem
```

更多见 [deploy/README.md](./deploy/README.md)。

---

<div align="center">

<sub>Whoga · Self-hosted RDAP & WHOIS · MIT License</sub>

</div>
