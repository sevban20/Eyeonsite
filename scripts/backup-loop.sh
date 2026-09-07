#!/bin/sh
# Runs backup-db.sh once immediately, then once every BACKUP_INTERVAL_HOURS
# (default 24h). Used as the `backup` service's entrypoint in docker-compose.yml.
set -eu
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"

while true; do
  /scripts/backup-db.sh || echo "[backup] backup-db.sh failed, will retry next interval"
  sleep "$((INTERVAL_HOURS * 3600))"
done
