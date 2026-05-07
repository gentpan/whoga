<div align="center">

# WHO.GA

**RDAP / WHOIS 域名查询站 — Next.js 16 + TypeScript**

<p>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=for-the-badge" alt="License">
</p>

<p>
  🌐 <a href="https://who.ga">who.ga</a> ·
  📡 <a href="https://api.who.ga">api.who.ga</a>
</p>

</div>

---

## 📖 概述

WHO.GA 是一个基于 Next.js 16 + TypeScript 的 RDAP / WHOIS 查询站，提供网页查询体验与可直接集成的 JSON API。

- **首页:** `https://who.ga`
- **API:** `https://api.who.ga`

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

## 🚀 本地开发

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
