<div align="center">

<img src="./public/logo.svg" width="88" alt="Whoga" />

# Whoga

**Self-hosted RDAP & WHOIS lookup**

Web UI + JSON API · Domain · TLD · IP · ASN

<p>
  <strong>English</strong>
  &nbsp;·&nbsp;
  <a href="./README.md" style="text-decoration:none;color:#6b7280;">中文</a>
</p>

<p>
  <a href="https://who.ga" style="text-decoration:none;color:#16a34a;font-weight:600;">who.ga</a>
  &nbsp;·&nbsp;
  <a href="https://who.ga/learn/en" style="text-decoration:none;color:#111827;font-weight:600;">Guides</a>
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

## Features

- RDAP lookup for domains, TLDs, IPs, and ASN
- WHOIS port43 fallback when RDAP is unavailable
- Local data index with scheduled refresh
- Optional Redis caching

## Quick Start

```bash
git clone https://github.com/gentpan/whoga.git
cd whoga
pnpm install
pnpm dev
```

Open <a href="http://localhost:3410" style="text-decoration:none;color:#16a34a;font-weight:600;">localhost:3410</a>

Production:

```bash
pnpm build && pnpm start
```

## API

```bash
curl "http://localhost:3410/api/whois?query=google.com"
curl "http://localhost:3410/api/whois?query=8.8.8.8"
curl "http://localhost:3410/api/whois?query=AS15169"
```

Live demo: <a href="https://api.who.ga/google.com" style="text-decoration:none;color:#16a34a;font-weight:600;">api.who.ga/google.com</a>

## Configuration

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Bearer token for refresh endpoint (recommended in production) |
| `REDIS_URL` | Redis cache connection |
| `WHOIS_CACHE_TTL_SECONDS` | Cache TTL in seconds, default `900` |

## Data Refresh

With the server running:

```bash
pnpm refresh:data
```

Or `curl -X POST http://localhost:3410/api/admin/refresh`

Data paths: `data/` (seed) → `runtime/data/` (runtime, preferred)

## Project layout

```
whoga/
├── web/           # Frontend (TanStack Start pages & components)
├── api/           # Backend (Nitro routes + HTTP handlers)
├── public/        # Static assets (logo, favicons, robots.txt)
├── lib/           # Shared business logic
├── data/          # Seed data
├── runtime/       # Runtime data (gitignore)
├── scripts/       # Ops & data scripts
└── deploy/        # Deployment scripts
```

## Deploy

```bash
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem
```

See <a href="./deploy/README.md" style="text-decoration:none;color:#16a34a;font-weight:600;">deploy/README.md</a> for details.

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
