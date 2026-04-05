# RDAP WHOIS 查询站

基于 Next.js + TypeScript 开发，支持：

- 输入域名查询 WHOIS/RDAP JSON
- 每日自动同步数据文件并自动重建派生文件
- 提供手动/定时刷新接口
- 深色/浅色主题切换
- 蓝黑风格（主色 `#0052D9`）

## 推荐开发语言

最推荐：**TypeScript**。

原因：

- Next.js 官方生态对 TypeScript 支持最好
- RDAP 返回 JSON 结构复杂，TypeScript 更适合控制类型和接口稳定性
- 对后续 API 扩展（鉴权、缓存、限流）更友好

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## API

### 1) 查询域名

`GET /api/whois?domain=example.com`

返回示例：

```json
{
  "domain": "example.com",
  "rdapServer": "https://rdap.verisign.com/com/v1/",
  "source": {
    "dnsJsonUrl": "https://data.iana.org/rdap/dns.json",
    "localUpdatedAt": "2026-02-20T10:00:00.000Z",
    "publication": "..."
  },
  "cache": {
    "hit": false,
    "backend": "redis"
  },
  "result": {}
}
```

缓存说明：

- 查询先走 bootstrap（本地 `dns.json`/`whois-merged.json`）解析 RDAP 服务器
- 成功查询结果会缓存（默认 TTL 900 秒）
- 优先使用 Redis；未配置 Redis 时自动回退进程内内存缓存

### 2) 强制刷新本地数据源并重建合并文件

`GET /api/admin/refresh` 或 `POST /api/admin/refresh`

- 若配置 `CRON_SECRET`，则需要请求头：

`Authorization: Bearer <CRON_SECRET>`

## 每日自动更新

当前已提供两层保障：

- 查询接口在调用时会检查本地数据是否超过 1 天，超过就自动更新
- `vercel.json` 配置了每日定时任务调用 `/api/admin/refresh`

每次刷新会更新并重建：

- `data/dns.json`
- `data/update-meta.json`（统一更新时间与来源分类，供前端读取）
- `data/rdap-servers-extra.json`（本地保留文件，不存在时自动初始化）
- `data/public_suffix_list.dat`
- `data/whois-merged.json`
- `data/tld-categories.json`
- `data/tlds.json`

可选环境变量：

- `RDAP_EXTRA_SOURCE_URL`：如果配置，则每日从该 URL 拉取并覆盖 `data/rdap-servers-extra.json`；未配置时使用本地文件。
- `REDIS_URL`：Redis 连接串（例如 `redis://127.0.0.1:6379`）。配置后缓存后端切换为 Redis。
- `WHOIS_CACHE_TTL_SECONDS`：WHOIS 查询缓存 TTL，默认 `900` 秒，最小有效值 `30`。

如果你部署在 Vercel，Cron 会自动生效。若部署在自建服务器，可用系统 `cron` 每天请求一次该接口。

## 数据治理（JSON 分类 / 合并 / 精简）

- 数据清单：`data/data-manifest.json`
  - `layer`：`raw` / `normalized` / `derived` / `meta`
  - `runtimeUsed`：是否在运行时热路径使用
- 审计命令：

```bash
npm run audit:data
npm run audit:data:strict
```

执行后会输出：

- 各 layer 文件数量与体积
- 完全重复文件组（如存在）
- Top 大文件
- 自动生成 `data/data-audit-report.json` 报告（可用于 CI）

### TLD 可查/不可查自动检测

基于 `data/tlds.json` 自动检测全部后缀的可查状态（可查/不可查）：

```bash
npm run check:tlds-queryability
```

执行后会生成：

- `data/tlds-queryability-report.json`

报告包含：

- 总后缀数、可查数、不可查数、可查率
- 可查后缀列表与不可查后缀列表
- 每个后缀来自哪些来源列表（`queryable/categories/ianaRoot/cannotQueryRoot`）

### 全量 RDAP 自动测试（按后缀逐个探测）

基于 `data/tlds.json + data/whois-merged.json` 自动测试所有可查后缀的 RDAP 响应可用性：

```bash
npm run test:rdap-all
```

执行后会生成：

- `data/rdap-domain-test-report.json`

报告包含：

- 全量测试通过/失败统计
- 失败后缀清单（含 `rdapBaseUrl`、HTTP 状态、失败原因）
- 按 RDAP 服务地址聚合的失败列表

重复文件治理策略：

- `data/dns.json` 作为 IANA RDAP 唯一上游源
- 不再保留 `rdap-servers-iana.json` 镜像，减少冗余文件与维护成本

查询优先级策略：

- 域名/后缀查询先匹配 `data/dns.json`（IANA 自动更新主源）
- 若 `dns.json` 未命中，再匹配 `data/rdap-servers-extra.json`（自定义补充源）
