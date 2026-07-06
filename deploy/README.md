# 部署 Deploy · Whoga

| 脚本 | 环境 | 说明 |
|------|------|------|
| `deploy-caddy.sh` | 生产 | Caddy + systemd，当前主用 |
| `deploy-bt.sh` | 宝塔面板 | 备用，PM2 部署 |

```bash
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem
```

服务器路径：`/opt/who.ga`，运行时数据：`/opt/who.ga/runtime/`。
