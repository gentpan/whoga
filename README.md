<div align="center">

<img src="./public/logo.svg" width="88" alt="Whoga" />

# Whoga

**自托管 RDAP / WHOIS 查询平台**

Web 界面 + JSON API · 域名 · 后缀 · IP · ASN

<p>
  <a href="./README.en.md" style="text-decoration:none;color:#6b7280;">English</a>
  &nbsp;·&nbsp;
  <strong>中文</strong>
</p>

<p>
  <a href="https://who.ga" style="text-decoration:none;color:#16a34a;font-weight:600;">who.ga</a>
  &nbsp;·&nbsp;
  <a href="https://who.ga/learn" style="text-decoration:none;color:#111827;font-weight:600;">技术指南</a>
  &nbsp;·&nbsp;
  <a href="https://api.who.ga" style="text-decoration:none;color:#111827;font-weight:600;">api.who.ga</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/gentpan/whoga/issues" style="text-decoration:none;color:#111827;font-weight:600;">Issues</a>
</p>

<br />

<img src="https://img.shields.io/github/stars/gentpan/whoga?style=for-the-badge&logo=github&logoColor=white" alt="GitHub stars" />
<img src="https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge" alt="MIT License" />
<img src="https://img.shields.io/badge/demo-who.ga-111827?style=for-the-badge" alt="Demo" />

<br /><br />

<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="React 19" />
<img src="https://img.shields.io/badge/TanStack_Start-FF4154?style=for-the-badge&logo=react&logoColor=white" alt="TanStack Start" />
<img src="https://img.shields.io/badge/Nitro-00DC82?style=for-the-badge" alt="Nitro" />
<img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />

<br />

<img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/pnpm-9+-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
<img src="https://img.shields.io/badge/RDAP-✓-0ea5e9?style=for-the-badge" alt="RDAP" />
<img src="https://img.shields.io/badge/WHOIS_fallback-✓-8b5cf6?style=for-the-badge" alt="WHOIS fallback" />
<img src="https://img.shields.io/badge/Redis-optional-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />

</div>

<br />

## 功能

- **RDAP 优先查询**域名、后缀(TLD)、IPv4 / IPv6、ASN,结构化 JSON 输出
- **多层回退**:无 RDAP 时自动走 WHOIS port43(主机名模式探测 + IANA 转介跟随),再到第三方 HTTP WHOIS API
- **后缀覆盖 1,380+**:IANA 根区 TLD 绝大部分可查,含 40+ 个仅靠 WHOIS 回退的后缀与 20+ 个网页注册局(返回注册局元数据)
- **三套界面主题**:浅色 / 深色 / 终端(等宽字体 + 磷光绿 + 命令回显),一键切换、本地记忆
- 超椭圆(squircle)圆角 UI:`corner-shape: squircle`,不支持的浏览器自动降级
- 中英双语界面与文档
- 本地数据索引,每日定时与 IANA 同步;Redis 缓存(可选)

## 快速开始

```bash
git clone https://github.com/gentpan/whoga.git
cd whoga
pnpm install
pnpm dev
```

访问 <a href="http://localhost:3410" style="text-decoration:none;color:#16a34a;font-weight:600;">localhost:3410</a>

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

线上版支持路径式调用:<a href="https://api.who.ga/google.com" style="text-decoration:none;color:#16a34a;font-weight:600;">api.who.ga/google.com</a>

## 技术栈

**后端不是 Go,也没有独立后端** — 这是一个单仓 TypeScript 全栈应用:网页和 JSON API 跑在同一个 Node.js 进程里,一次构建、一次部署。

| 部分 | 说明 |
|------|------|
| **语言** | TypeScript(前后端统一) |
| **运行** | Node.js 20+ · pnpm |
| **全栈框架** | TanStack Start(SSR)+ Nitro(服务端) |
| **前端** | React 19 · Vite · TanStack Router(文件式路由) |
| **交互** | [Base UI](https://base-ui.com)(菜单、Tooltip 等,样式由项目 CSS 定制) |
| **样式** | 原生 CSS 变量 + 主题系统 · Sora 字体 · Lucide 图标 |
| **API** | 同仓库 `api/` 目录的 Nitro handler,与页面共用一套服务 |
| **缓存** | Redis(可选) |

日常只需要:

```bash
pnpm install    # 安装
pnpm dev        # 开发(localhost:3410)
pnpm build && pnpm start   # 生产
```

## 配置

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `CRON_SECRET` | 刷新接口密钥(生产建议设置) |
| `REDIS_URL` | Redis 缓存 |
| `WHOIS_CACHE_TTL_SECONDS` | 缓存时间,默认 900 |

## 数据更新

服务运行后,手动刷新本地索引:

```bash
pnpm refresh:data
```

或 `curl -X POST http://localhost:3410/api/admin/refresh`

数据目录:`data/`(种子)→ `runtime/data/`(运行时,优先读取)

常用数据脚本:

```bash
pnpm sync:rdap-extra        # 重新生成补充 RDAP 映射
pnpm scan:whois-hosts       # 探测无 RDAP 后缀的 WHOIS 主机
pnpm test:rdap-all          # 实测所有后缀 RDAP 端点活性
pnpm check:tlds-queryability # 输出后缀可查询率报告
```

## 项目结构

```
whoga/
├── web/           # 前端:路由(routes/)、组件(components/)、样式与文案(lib/)
├── api/           # HTTP API handler(/api/whois、/api/stats 等)
├── lib/           # 共享业务逻辑(RDAP/WHOIS、数据索引、回退链)
├── data/          # 种子数据(RDAP 映射、TLD 清单等)
├── runtime/       # 运行时数据(gitignore,优先读取)
├── public/        # 静态资源(logo、favicon、robots.txt)
├── scripts/       # 数据刷新与运维脚本
└── deploy/        # 部署脚本
```

## 部署

```bash
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem
```

更多见 <a href="./deploy/README.md" style="text-decoration:none;color:#16a34a;font-weight:600;">deploy/README.md</a>

---

<div align="center">

<br />

<a href="https://who.ga" style="text-decoration:none;color:#16a34a;font-weight:600;">who.ga</a>
&nbsp;·&nbsp;
<a href="https://github.com/gentpan/whoga" style="text-decoration:none;color:#111827;font-weight:600;">GitHub</a>
&nbsp;·&nbsp;
<a href="./LICENSE" style="text-decoration:none;color:#111827;font-weight:600;">MIT</a>

<br /><br />

<sub>Whoga · Self-hosted RDAP & WHOIS</sub>

</div>
