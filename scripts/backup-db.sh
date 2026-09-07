#!/bin/sh
# Faz 1.6 — PostgreSQL backup script.
#
# Dumps the database to a timestamped, gzip-compressed file and deletes dumps
# older than BACKUP_RETENTION_DAYS. Designed to run either:
#   1. Inside the `backup` service added to docker-compose.yml (on a loop), or
#   2. As a host/cron job: `docker compose exec -T db sh -c '...'`-style, or
#      directly on a host that has `pg_dump` and network access to the DB.
#
# Required env vars (already present in .env for the `app`/`db` services):
#   DB_USER, DB_PASSWORD, DB_NAME  — or a full DATABASE_URL
# Optional:
#   BACKUP_DIR              — where dumps are written (default: /backups)
#   BACKUP_RETENTION_DAYS   — how long to keep dumps (default: 14)
#   PGHOST / PGPORT         — default to "db" / 5432 (the compose service name)

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-uptimemonitor}"

mkdir -p "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%d-%H%M%S)
dest="$BACKUP_DIR/${DB_NAME}-${timestamp}.sql.gz"

echo "[backup] Dumping $DB_NAME@$PGHOST:$PGPORT -> $dest"
PGPASSWORD="${DB_PASSWORD:-postgres}" pg_dump \
  -h "$PGHOST" -p "$PGPORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges \
  | gzip > "$dest"

echo "[backup] Done: $(du -h "$dest" | cut -f1)"

echo "[backup] Pruning dumps older than ${RETENTION_DAYS} day(s) in $BACKUP_DIR"
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete
