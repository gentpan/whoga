#!/usr/bin/env bash
# 定时刷新 RDAP/WHOIS 本地数据索引
# 用法：
#   ./scripts/data-refresh-cron.sh
#   PORT=3410 CRON_SECRET=xxx ./scripts/data-refresh-cron.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3410}"
HOST="${HOST:-127.0.0.1}"
LOG_DIR="${LOG_DIR:-$ROOT/runtime/logs}"
LOG_FILE="$LOG_DIR/data-refresh.log"
LOCK_FILE="${LOCK_FILE:-/tmp/whoga-data-refresh.lock}"

mkdir -p "$LOG_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) refresh already running" >> "$LOG_FILE"
  exit 0
fi

{
  echo "===== $(date -Is) Whoga data refresh start ====="
  if [ -f "$ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  if [ -f "$ROOT/.env.local" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env.local"
    set +a
  fi
  if [ -f "$ROOT/.env.production.local" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env.production.local"
    set +a
  fi

  node "$ROOT/scripts/sync-rdap-extra.mjs" || echo "sync-rdap-extra failed; continuing"

  # 应用优先读 runtime/data,把重新生成的映射同步过去再刷新
  if [ -d "$ROOT/runtime/data" ]; then
    cp -f "$ROOT/data/rdap-servers-extra.json" "$ROOT/runtime/data/rdap-servers-extra.json" 2>/dev/null || true
  fi

  if [ -n "${CRON_SECRET:-}" ]; then
    curl -fsS --max-time 900 -X POST \
      -H "Authorization: Bearer $CRON_SECRET" \
      "http://$HOST:$PORT/api/admin/refresh"
  else
    curl -fsS --max-time 900 -X POST "http://$HOST:$PORT/api/admin/refresh"
  fi

  echo "===== $(date -Is) Whoga data refresh done ====="
} >> "$LOG_FILE" 2>&1

# 日志超过 5MB 时只保留尾部 1MB
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  tail -c 1048576 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
