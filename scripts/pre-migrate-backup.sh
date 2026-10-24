#!/bin/sh
# Migration uygulanmadan ONCE veritabaninin anlik yedegini alir.
#
# Neden: `migrate deploy` kendiliginden veri dusurmez ama migration SQL'i
# dusurebilir (yeniden adlandirilan bir kolon, kaldirilan bir tablo). Ayrica
# bir deploy'un yanlis gittigi an, geri donulecek noktanin saatler oncesine
# ait olmasi ile dakikalar oncesine ait olmasi arasinda cok fark var.
#
# Bu script app container'inin acilisinda, migrate deploy'dan hemen once
# calisir. Dump, backup servisiyle AYNI volume'e yazilir, boylece retention
# temizligi de onu kapsar.
#
# ASLA deploy'u engellemez: yedek alinamazsa uyari basar ve 0 ile cikar.
# Aksi halde, saglikli ama yedeklenemeyen bir sistemi acilista kilitlerdik.

set -u

BACKUP_DIR="${BACKUP_DIR:-/backups}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[pre-migrate] $BACKUP_DIR yok, yedek atlaniyor"
  exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[pre-migrate] pg_dump bulunamadi, yedek atlaniyor"
  exit 0
fi

# Bekleyen migration var mi? Yoksa her yeniden baslatmada gereksiz dump
# uretmeyelim; container restart'lari sik olabiliyor.
if npx prisma migrate status 2>/dev/null | grep -q "Database schema is up to date"; then
  echo "[pre-migrate] bekleyen migration yok, yedek gerekmiyor"
  exit 0
fi

timestamp=$(date -u +%Y%m%d-%H%M%S)
dest="$BACKUP_DIR/premigrate-${timestamp}.sql.gz"

echo "[pre-migrate] Bekleyen migration var — once yedek aliniyor: $dest"

# Baglanti bilgileri DATABASE_URL'den okunur; app servisinde DB_* degiskenleri
# bulunmayabilir.
if pg_dump --no-owner --no-privileges -d "$DATABASE_URL" | gzip > "$dest"; then
  echo "[pre-migrate] Tamam: $(du -h "$dest" | cut -f1)"
else
  echo "[pre-migrate] UYARI: yedek alinamadi, deploy yine de suruyor" >&2
  rm -f "$dest" 2>/dev/null || true
fi

exit 0
