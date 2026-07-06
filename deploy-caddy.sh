#!/bin/bash
# ============================================================
# who.ga 生产部署（Caddy + systemd）
# 服务器: 8.217.86.171
# 路径: /opt/who.ga
# 用法: ./deploy-caddy.sh [ssh_key]
# ============================================================

set -euo pipefail

HOST="root@8.217.86.171"
KEY="${1:-$HOME/.ssh/gentpan.pem}"
REMOTE_DIR="/opt/who.ga"
RUNTIME_DATA="$REMOTE_DIR/runtime/data"
SERVICE="who-ga"

if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY"
  exit 1
fi

chmod 600 "$KEY"

SSH="ssh -i $KEY -o StrictHostKeyChecking=no"
RSYNC_SSH="ssh -i $KEY -o StrictHostKeyChecking=no"

echo "[1/7] Sync app files..."
rsync -avz --delete \
  -e "$RSYNC_SSH" \
  --exclude node_modules \
  --exclude .output \
  --exclude .tanstack \
  --exclude runtime \
  --exclude .git \
  --exclude '.env*' \
  ./ "$HOST:$REMOTE_DIR/"

echo "[2/7] Ensure runtime directory on server..."
$SSH "$HOST" "mkdir -p $RUNTIME_DATA"

echo "[3/7] Build on server..."
$SSH "$HOST" "cd $REMOTE_DIR && pnpm install && pnpm build"

echo "[4/7] Restart service..."
$SSH "$HOST" "systemctl restart $SERVICE && systemctl is-active $SERVICE"

echo "[5/7] Refresh data index..."
$SSH "$HOST" "sleep 2 && cd $REMOTE_DIR && \
  CRON_SECRET=\$(grep -E '^CRON_SECRET=' .env.production.local 2>/dev/null | cut -d= -f2- | tr -d '\"') && \
  if [ -n \"\$CRON_SECRET\" ]; then \
    curl -fsS -X POST -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3410/api/admin/refresh; \
  else \
    curl -fsS -X POST http://127.0.0.1:3410/api/admin/refresh; \
  fi"

echo "[6/7] Re-sync curated seed data into runtime..."
rsync -avz \
  -e "$RSYNC_SSH" \
  data/rdap-servers-extra.json data/missing-tld-lookup.json data/whois-extra-hosts.json data/cannot-query-root-tlds.txt \
  "$HOST:$RUNTIME_DATA/"

echo "[7/7] Rebuild merged index after curated sync..."
$SSH "$HOST" "sleep 1 && cd $REMOTE_DIR && \
  CRON_SECRET=\$(grep -E '^CRON_SECRET=' .env.production.local 2>/dev/null | cut -d= -f2- | tr -d '\"') && \
  if [ -n \"\$CRON_SECRET\" ]; then \
    curl -fsS -X POST -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3410/api/admin/refresh; \
  else \
    curl -fsS -X POST http://127.0.0.1:3410/api/admin/refresh; \
  fi"

echo "Done. https://who.ga"
