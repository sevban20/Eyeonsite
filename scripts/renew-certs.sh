#!/bin/sh
# Let's Encrypt sertifikalarini yeniler ve nginx'e yukletir.
#
# nginx bir container icinde calistigi ve 443'u tuttugu icin certbot'un
# --standalone modu portu alamaz; bu yuzden webroot yerine "once nginx'i
# durdur, yenile, kopyala, baslat" akisi kullaniliyor. Yenileme ~30 saniye
# surer ve yalnizca sertifika gercekten yenilenmeye yakinsa (30 gunden az
# kalmissa) certbot bir sey yapar.
#
# Kurulum (sunucuda, proje dizininde):
#   chmod +x scripts/renew-certs.sh
#   sudo crontab -e
#   0 4 * * 1 cd /opt/Eyeonsite && ./scripts/renew-certs.sh >> /var/log/eyeonsite-renew.log 2>&1
#
# Haftada bir calismasi yeterlidir: sertifika 90 gun gecerli, certbot son 30
# gune girmeden yenilemez.

set -eu

DOMAIN="${CERT_DOMAIN:-eyeon.site}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_DIR="./nginx/certs"

echo "[renew] $(date -u +%FT%TZ) starting for ${DOMAIN}"

# Sertifika 30 gunden fazla gecerliyse hicbir sey yapma — nginx'i bosuna
# durdurmayalim.
if [ -f "${CERT_DIR}/eyeonsite.pem" ] && \
   openssl x509 -checkend 2592000 -noout -in "${CERT_DIR}/eyeonsite.pem" >/dev/null 2>&1; then
  echo "[renew] certificate still valid for more than 30 days, nothing to do"
  exit 0
fi

echo "[renew] stopping nginx to free port 80"
docker compose stop nginx

# nginx yeniden baslatilmadan cikilmasin — certbot hata verse bile.
cleanup() {
  echo "[renew] starting nginx again"
  docker compose start nginx
}
trap cleanup EXIT

certbot renew --standalone --non-interactive --agree-tos

if [ -f "${LIVE_DIR}/fullchain.pem" ]; then
  echo "[renew] copying renewed certificate into ${CERT_DIR}"
  cp "${LIVE_DIR}/fullchain.pem" "${CERT_DIR}/eyeonsite.pem"
  cp "${LIVE_DIR}/privkey.pem"   "${CERT_DIR}/eyeonsite.key"
else
  echo "[renew] WARNING: ${LIVE_DIR}/fullchain.pem not found — certificate not updated" >&2
  exit 1
fi

echo "[renew] done"
