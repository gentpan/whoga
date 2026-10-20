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

## Features

- **RDAP-first lookup** for domains, TLD suffixes, IPv4/IPv6, and ASNs, with structured JSON output
- **Multi-layer fallback**: WHOIS port43 (hostname probing + IANA referral chasing) when RDAP is unavailable, then third-party HTTP WHOIS APIs
- **1,380+ suffix coverage**: nearly the entire IANA root zone, including 40+ suffixes served via WHOIS fallback and 20+ web-only registries (registry metadata)
- **Three UI themes**: light / dark / terminal (monospace, phosphor green, command echo) — one-click switch, persisted locally
- Squircle corners via `corner-shape: squircle` with automatic fallback in unsupported browsers
- Bilingual UI and docs (中文 / English)
- Local data index synced with IANA daily; optional Redis caching

## Quick start

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
curl "http://localhost:3410/api/whois?domain=google.com"
curl "http://localhost:3410/api/whois?domain=8.8.8.8"
curl "http://localhost:3410/api/whois?domain=AS15169"
```

The hosted API also accepts path-style calls: <a href="https://api.who.ga/google.com" style="text-decoration:none;color:#16a34a;font-weight:600;">api.who.ga/google.com</a>

## Stack

**The backend is not Go — there is no separate backend at all.** This is a single-repository TypeScript full-stack app: the web UI and the JSON API run in the same Node.js process, with one build and one deploy.

| Layer | Details |
|-------|---------|
| **Language** | TypeScript end to end |
| **Runtime** | Node.js 20+ · pnpm |
| **Framework** | TanStack Start (SSR) + Nitro (server) |
| **Frontend** | React 19 · Vite · TanStack Router (file-based routes) |
| **UI primitives** | [Base UI](https://base-ui.com) (menus, tooltips; styled by project CSS) |
| **Styling** | Plain CSS variables + theme system · Sora · Lucide icons |
| **API** | Nitro handlers in `api/`, same process as the pages |
| **Cache** | Redis (optional) |

Day to day:

```bash
pnpm install    # install
pnpm dev        # develop (localhost:3410)
pnpm build && pnpm start   # production
```

## Configuration

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Secret for the refresh endpoint (recommended in production) |
| `REDIS_URL` | Redis cache |
| `WHOIS_CACHE_TTL_SECONDS` | Cache TTL, default 900 |

## Data updates

With the server running, refresh the local index manually:

```bash
pnpm refresh:data
```

or `curl -X POST http://localhost:3410/api/admin/refresh`

Data directories: `data/` (seed) → `runtime/data/` (runtime, takes precedence)

Useful data scripts:

```bash
pnpm sync:rdap-extra        # regenerate supplementary RDAP mappings
pnpm scan:whois-hosts       # probe WHOIS hosts for suffixes without RDAP
pnpm test:rdap-all          # live-test every suffix's RDAP endpoint
pnpm check:tlds-queryability # print the suffix coverage report
```

## Project layout

```
whoga/
├── web/           # frontend: routes/, components/, styles & copy in lib/
├── api/           # HTTP API handlers (/api/whois, /api/stats, ...)
├── lib/           # shared logic (RDAP/WHOIS, data index, fallback chain)
├── data/          # seed data (RDAP mappings, TLD lists, ...)
├── runtime/       # runtime data (gitignored, takes precedence)
├── public/        # static assets (logo, favicon, robots.txt)
├── scripts/       # data refresh & ops scripts
└── deploy/        # deployment scripts
```

## Deployment

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
