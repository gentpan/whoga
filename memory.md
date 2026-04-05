# WHO.GA Memory

## 产品定位

WHO.GA 是一个 RDAP / WHOIS 查询站，同时提供网页查询与直接可调用的 JSON API。

- 主站: `https://who.ga`
- API: `https://api.who.ga`

## 当前产品约定

- 首页展示品牌区、搜索区、请求图表、API 用法、Why WHO.GA、支持后缀、FAQ
- 查询结果页不展示首页这些扩展板块
- `api.who.ga/` 跳转首页
- `api.who.ga/<query>` 直接返回 JSON
- API 与首页查询共用同一条 `/api/whois` 数据链路

## 支持的查询对象

- 域名
- 域名后缀
- IPv4 / IPv6
- ASN

## 国际化后缀约定

- 页面优先显示解码后的原始语言后缀
- 不再在卡片底部显示 `xn--...`
- 查询时仍需转换为可查询的值，兼容原始语言与 punycode

## 请求统计约定

- 每天从 0 开始累计
- 系统按小时补充随机请求量
- 真实用户请求实时叠加进去
- 当天结束后保留为历史数据
- 最近 30 天统计持久化保存
- 首页图表展示最近 21 天

当前小时补量设计:

- 深夜较低
- 上午上升
- 白天高峰
- 夜间回落

## 统计持久化

- 默认目录: `../whoga-runtime`
- 默认文件: `../whoga-runtime/query-stats.json`

可用环境变量:

- `QUERY_STATS_DIR`
- `REDIS_URL`

## 部署信息

- 服务器 IP: `191.101.132.41`
- SSH 用户: `root`
- SSH 端口: `22`
- 项目目录: `/www/wwwroot/whoga`
- 运行进程: `pm2 -> whoga`

## 当前运行域名

- `who.ga` 为首页与结果页
- `api.who.ga` 为 JSON API 入口

## 重要文件

- `app/page.tsx`: 首页、结果页与多数展示逻辑
- `app/globals.css`: 全局样式与图表/品牌区样式
- `app/layout.tsx`: metadata、icons、统计脚本
- `app/api/whois/route.ts`: 统一查询入口
- `app/api/suffixes/route.ts`: 后缀列表与 IDN 展示数据
- `lib/query-stats.ts`: 请求统计、每日补量、文件持久化
- `middleware.ts`: `api.who.ga/<query>` 改写与首页跳转

## 数据相关文件

- `data/dns.json`
- `data/whois-merged.json`
- `data/update-meta.json`
- `data/tlds.json`
- `data/tld-categories.json`
- `data/public_suffix_list.dat`

## 当前前端约定

- 主题绿: `#22C55F`
- 卡片圆角统一为 `4px`
- 请求图表为纯绿色矩形柱状图
- 搜索按钮为绿色正圆放大镜
- 页脚保留 `X`、`GitHub` 与 `GiantAccel`

## 页脚链接

- X: `https://x.com/gentpan`
- GitHub: `https://github.com/gentpan`
- GiantAccel: `https://giantaccel.com`

## 常用命令

```bash
npm run dev
npm run build
npm run test:data-availability
npm run test:rdap-all
pm2 restart whoga
```
