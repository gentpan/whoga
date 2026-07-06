# 部署 Deploy

| 脚本 | 环境 | 说明 |
|------|------|------|
| `deploy-caddy.sh` | 生产 `8.217.86.171` | Caddy + systemd，当前主用 |
| `deploy-bt.sh` | 宝塔面板 | 备用，PM2 部署 |

```bash
# 生产部署（从仓库根目录或任意位置执行均可）
./deploy/deploy-caddy.sh ~/.ssh/gentpan.pem
```

服务器路径：`/opt/who.ga`，运行时数据：`/opt/who.ga/runtime/`。
