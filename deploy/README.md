# 部署 Deploy · Whoga

| 脚本 | 环境 | 说明 |
|------|------|------|
| `deploy-caddy.sh` | 生产 | Caddy + systemd，当前主用 |
| `deploy-bt.sh` | 宝塔面板 | 备用，PM2 部署 |

```bash
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem            # 默认服务器 166.0.22.246
./deploy/deploy-caddy.sh ~/.ssh/your-key.pem root@<ip>  # 指定其他服务器
```

服务器路径：`/opt/who.ga`，运行时数据：`/opt/who.ga/runtime/`。
