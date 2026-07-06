# 工具脚本 Scripts

数据审计、同步、测试与**定时刷新**。

```bash
pnpm refresh:data          # 调用 /api/admin/refresh 刷新本地数据索引
pnpm sync:rdap-extra       # 同步额外 RDAP 映射
pnpm scan:whois-hosts      # 扫描 WHOIS 主机
pnpm audit:data            # 数据审计报告
```

定时任务可直接使用 `data-refresh-cron.sh`，详见根目录 [README.md](../README.md#配置定时自动更新)。
