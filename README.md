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
  <a href="https://api.who.ga" style="text-decoration:none;color:#111827;font-weight:600;">api.who.ga</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/gentpan/whoga/issues" style="text-decoration:none;color:#111827;font-weight:600;">Issues</a>
</p>

<br />

<img src="https://img.shields.io/github/stars/gentpan/whoga?style=for-the-badge&logo=github&logoColor=white" alt="GitHub stars" />
<img src="https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge" alt="MIT License" />
<img src="https://img.shields.io/badge/demo-who.ga-111827?style=for-the-badge" alt="Demo" />

<br /><br />

<img src="https://img.shields.io/badge/TanStack_Start-FF4154?style=for-the-badge&logo=react&logoColor=white" alt="TanStack Start" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
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

- RDAP 查询域名、TLD、IP、ASN
- 无 RDAP 时 WHOIS port43 自动回退
- 本地数据索引，支持定时刷新
- Redis 缓存（可选）

## 快速开始

```bash
git clone https://github.com/gentpan/whoga.git
cd whoga
pnpm install
pnpm dev
```

访问 <a href="http://localhost:3410" style="text-decoration:none;color:#16a34a;font-weight:600;">localhost:3410</a>

生产环境：

```bash
pnpm build && pnpm start
```

## API

```bash
curl "http://localhost:3410/api/whois?query=google.com"
curl "http://localhost:3410/api/whois?query=8.8.8.8"
curl "http://localhost:3410/api/whois?query=AS15169"
```

在线示例：<a href="https://api.who.ga/google.com" style="text-decoration:none;color:#16a34a;font-weight:600;">api.who.ga/google.com</a>

## 配置

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `CRON_SECRET` | 刷新接口密钥（生产建议设置） |
| `REDIS_URL` | Redis 缓存 |
| `WHOIS_CACHE_TTL_SECONDS` | 缓存时间，默认 900 |

## 数据更新

服务运行后，手动刷新本地索引：

```bash
pnpm refresh:data
```

或 `curl -X POST http://localhost:3410/api/admin/refresh`

数据目录：`data/`（种子）→ `runtime/data/`（运行时，优先读取）

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
