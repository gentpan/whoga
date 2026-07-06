<div align="center">

# Whoga

**自托管 RDAP / WHOIS 查询平台 — 带 Web 界面与 JSON API**

[who.ga](https://who.ga) 的开源实现。一条命令启动本地查询站，支持域名、后缀、IP、ASN 查询。

<p>
  <img src="https://img.shields.io/badge/TanStack_Start-1.168-FF4154?style=flat-square" alt="TanStack Start">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=111827" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Nitro-3.0-00DC82?style=flat-square" alt="Nitro">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License">
</p>

</div>

---

## 为什么叫 Whoga？

- **Whoga** = **Who** + **GA**，与线上产品 [who.ga](https://who.ga) 同名，简短好记
- GitHub 仓库名 `whoga` 保持不变，方便 fork 与部署
- 若你自建实例，可挂任意域名；Whoga 是软件项目名，who.ga 是官方演示站

---

## 功能

- 查询域名、TLD 后缀、IPv4/IPv6、ASN 的 RDAP 结构化数据
- 无 RDAP 时自动 WHOIS port43 回退
- Web 查询页 + `api.your-domain/<query>` JSON API
- 本地 RDAP 数据索引（IANA bootstrap + 后缀列表合并）
- Redis 或内存缓存，查询统计持久化
- 数据每日自动刷新（内置逻辑 + 可配 cron）

---

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 20（推荐 22+） |
| pnpm | ≥ 9 |
| Redis | 可选，用于缓存与统计 |

---

## 安装

```bash
git clone https://github.com/gentpan/whoga.git
cd whoga
pnpm install
cp .env.example .env    # 可选，见下方配置说明
```

首次启动前，仓库自带 `data/` 种子数据，可直接运行。完整索引会在首次刷新后写入 `runtime/data/`。

---

## 使用

### 开发模式

```bash
pnpm dev
```

打开 http://localhost:3410

### 生产构建

```bash
pnpm build
pnpm start
```

默认监听 `0.0.0.0:3410`，可通过反向代理（Caddy / Nginx）暴露 80/443。

### API 示例

```bash
# 域名
curl http://localhost:3410/api/whois?query=google.com

# 后缀
curl http://localhost:3410/api/whois?query=.com

# IP / ASN
curl http://localhost:3410/api/whois?query=8.8.8.8
curl http://localhost:3410/api/whois?query=AS15169

# 统计与元信息
curl http://localhost:3410/api/stats
curl http://localhost:3410/api/meta
```

线上演示：[api.who.ga](https://api.who.ga/google.com)

---

## 配置

复制 `.env.example` 为 `.env`（或 `.env.local`）：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WHOGA_RUNTIME_DIR` | 运行时数据根目录 | `./runtime` |
| `QUERY_STATS_DIR` | 查询统计文件目录 | `./runtime` |
| `CRON_SECRET` | 刷新接口 Bearer 密钥；**生产环境务必设置** | 未设置时接口开放 |
| `REDIS_URL` | Redis 连接串，如 `redis://127.0.0.1:6379` | 无则降级为内存缓存 |
| `WHOIS_CACHE_TTL_SECONDS` | 查询结果缓存秒数 | `900` |
| `RDAP_EXTRA_SOURCE_URL` | 额外 RDAP 映射 JSON 远程地址 | 无 |
| `GEO_TLDS_SOURCE_URL` | 地理 TLD 分类数据源 | 无 |

---

## 数据文件与自动更新

Whoga 使用**双层数据目录**：

```
whoga/
├── data/              # 种子数据（git 跟踪，只读模板）
└── runtime/           # 运行时数据（gitignore，可写）
    ├── data/          # 热路径 JSON，应用优先读取
    └── query-stats.json
```

**读取优先级：** `runtime/data/` → `data/`（种子回退）

### 更新机制

| 方式 | 触发条件 | 说明 |
|------|----------|------|
| **懒刷新** | 查询时自动检查 | 距上次同步超过 24 小时则拉取 IANA 数据并重建索引 |
| **手动刷新** | 调用管理接口 | 见下方命令 |
| **定时任务** | cron / systemd | 推荐生产环境每日执行 |

### 手动刷新

```bash
# 服务运行中执行（本地开发）
curl -X POST http://localhost:3410/api/admin/refresh

# 若设置了 CRON_SECRET
curl -X POST http://localhost:3410/api/admin/refresh \
  -H "Authorization: Bearer 你的密钥"
```

或使用封装脚本（会先同步 `rdap-servers-extra`，再调用刷新接口）：

```bash
pnpm refresh:data
# 或
./scripts/data-refresh-cron.sh
```

### 配置定时自动更新

**macOS / Linux（crontab）** — 每天凌晨 3:30 刷新：

```bash
crontab -e
```

添加一行（把路径改成你的克隆目录）：

```cron
30 3 * * * cd /path/to/whoga && PORT=3410 CRON_SECRET=你的密钥 ./scripts/data-refresh-cron.sh
```

> 服务需已运行（`pnpm start` 或 systemd）。脚本日志写入 `runtime/logs/data-refresh.log`。

**systemd timer（Linux 生产）** 示例：

```ini
# /etc/systemd/system/whoga-data-refresh.service
[Unit]
Description=Whoga RDAP data refresh
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/who.ga
EnvironmentFile=/opt/who.ga/.env
ExecStart=/opt/who.ga/scripts/data-refresh-cron.sh

# /etc/systemd/system/whoga-data-refresh.timer
[Unit]
Description=Daily Whoga data refresh

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

启用：`systemctl enable --now whoga-data-refresh.timer`

### 维护脚本

```bash
pnpm sync:rdap-extra          # 同步额外 RDAP 服务器映射
pnpm scan:whois-hosts         # 扫描 WHOIS 主机（预览）
pnpm scan:whois-hosts:write   # 写入扫描结果
pnpm audit:data               # 数据完整性审计
pnpm test:data-availability   # 数据可用性测试
```

---

## 项目结构

```
whoga/
├── src/                    # 前端 Frontend
│   ├── routes/             #   页面路由
│   ├── components/         #   React 组件
│   └── server/api/         #   API 业务处理
├── server/                 # 后端 Nitro 路由入口
├── lib/                    # 后端核心（RDAP、WHOIS 回退、缓存、同步）
├── data/                   # 种子数据
├── runtime/                # 运行时数据（不提交 git）
├── public/                 # 静态资源
├── scripts/                # 维护与刷新脚本
└── deploy/                 # 部署脚本
```

各目录有独立 `README.md` 说明职责。

---

## 部署

### 生产（Caddy + systemd）

```bash
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem
```

详见 [deploy/README.md](./deploy/README.md)。

### 宝塔面板（备用）

```bash
./deploy/deploy-bt.sh
```

---

## 开发

```bash
pnpm dev          # 启动开发服务器
pnpm lint         # TypeScript 检查
pnpm build        # 生产构建
```

---

## 相关链接

- 线上演示：[who.ga](https://who.ga)
- API 演示：[api.who.ga](https://api.who.ga)
- 问题反馈：[GitHub Issues](https://github.com/gentpan/whoga/issues)

---

## License

[MIT](./LICENSE)
