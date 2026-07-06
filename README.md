<div align="center">

# WHO.GA

**RDAP / WHOIS 域名查询站 — TanStack Start + Base UI**

<p>
  <img src="https://img.shields.io/badge/TanStack_Start-1.168-FF4154?style=for-the-badge" alt="TanStack Start">
  <img src="https://img.shields.io/badge/Base_UI-1.6-111827?style=for-the-badge" alt="Base UI">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=for-the-badge" alt="License">
</p>

<p>
  🌐 <a href="https://who.ga">who.ga</a> ·
  📡 <a href="https://api.who.ga">api.who.ga</a>
</p>

</div>

---

## 📖 概述

WHO.GA 是一个基于 TanStack Start 的 RDAP / WHOIS 查询站，提供网页查询体验与可直接集成的 JSON API。前端使用 React 19 与 Base UI，服务端接口由 Nitro 处理，查询数据优先读取本地 RDAP 数据目录。

- **首页:** `https://who.ga`
- **API:** `https://api.who.ga`

---

## 🧱 技术栈

- **应用框架:** TanStack Start `1.168.x`
- **路由:** TanStack Router `1.170.x`
- **UI 基础组件:** Base UI `1.6.x`
- **前端:** React `19.2.x` / React DOM `19.2.x`
- **语言:** TypeScript `6.0.x`
- **构建:** Vite `8.1.x`
- **服务端运行:** Nitro `3.0.x`
- **缓存与统计:** Redis / 本地 JSON 统计文件
- **图标:** Lucide React + 内置 SVG 品牌图标
- **包管理:** pnpm

---

## ✨ 功能

- 🔍 查询域名、后缀、IP、ASN 的结构化 RDAP 数据
- 📡 首页与 API 共用同一套查询链路
- 📦 `api.who.ga/<query>` 直接返回标准化 JSON
- 🧹 API 自动清洗上游 RDAP/WHOIS 响应中的 HTML 空格与异常空白字符
- 🌍 支持大量 TLD 与 IDN 国际化后缀
- 📊 首页内置请求图表、API 示例、FAQ、支持后缀展示
- ⚡ 支持 Redis 缓存与本地持久化统计
- 🧪 支持数据可用性测试与 TLD/RDAP 扫描脚本

---

## 📁 项目结构

单仓库 monorepo，本地只需 **`whoga/`** 一个文件夹（运行时数据在 `whoga/runtime/`，不进 git）。

```
whoga/
├── src/                    # 前端 Frontend
│   ├── routes/             #   页面路由（首页、查询页）
│   ├── components/         #   React 组件
│   ├── server/api/         #   后端 API 业务处理
│   └── styles.css
├── server/                 # 后端 Nitro 路由入口 Backend
│   ├── api/                #   HTTP 端点薄封装
│   └── middleware/         #   api.who.ga 子域中间件
├── lib/                    # 后端核心业务 Backend Core
│   ├── rdap-registry.ts    #   RDAP 路由
│   ├── whois-fallback.ts   #   WHOIS 回退
│   └── ...
├── data/                   # 种子数据 Seed（git 跟踪）
├── runtime/                # 运行时数据 Runtime（gitignore）
│   ├── data/               #   可写 JSON，优先读取
│   └── query-stats.json
├── public/                 # 静态资源
├── scripts/                # 数据维护脚本
├── deploy/                 # 部署脚本
│   ├── deploy-caddy.sh     #   生产主用
│   └── deploy-bt.sh        #   宝塔备用
├── package.json
└── vite.config.ts
```

各目录详见对应 `README.md`（`src/`、`server/`、`lib/`、`data/`、`deploy/`）。

**数据读取优先级：** `runtime/data/` → `data/`（种子回退）

---

## 🚀 本地开发

```bash
pnpm install
pnpm dev
```

默认启动后访问 `http://localhost:3410`。

生产构建:

```bash
pnpm build
pnpm start
```

生产部署:

```bash
./deploy/deploy-caddy.sh ~/.ssh/gentpan.pem
```

---

## 📡 API 用法

```bash
curl https://api.who.ga/google.tt
curl https://api.who.ga/8.8.8.8
curl https://api.who.ga/AS15169
curl https://api.who.ga/.com
```

- `https://api.who.ga/` → 跳转到 `https://who.ga/`
- `https://api.who.ga/<query>` → 返回 JSON

---

## 📄 License

MIT
