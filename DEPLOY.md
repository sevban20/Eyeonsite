# Eyeon.site — Sunucu Kurulum ve Deploy

Bu doküman, projeyi sıfır bir sunucuda canlıya almak için gereken adımları
sırasıyla anlatır. Tüm stack `docker compose` ile ayağa kalkar; sunucuda
Node.js veya PostgreSQL kurulu olmasına gerek yoktur.

## 0. Ön koşullar

- Sunucuda **Docker Engine + Docker Compose v2** kurulu
- **80 ve 443** portları boş ve firewall'da açık
- **DNS**: `eyeon.site` ve `www.eyeon.site` A kaydı sunucunun IP'sine bakıyor
  (nginx.conf bu iki `server_name` üzerine kurulu; farklı bir domain
  kullanacaksan nginx.conf'u ve `.env`'deki `APP_URL`'i birlikte güncelle)

## 1. Kodu al

```bash
git clone https://github.com/sevban20/Eyeonsite.git
cd Eyeonsite
```

## 2. .env dosyasını oluştur

`.env` repoda değildir (gitignore'da). Şablondan üret:

```bash
cp .env.example .env
```

Doldurulması gerekenler:

| Değişken | Not |
|---|---|
| `DATABASE_URL` | `postgresql://<DB_USER>:<DB_PASSWORD>@db:5432/<DB_NAME>?schema=public` — host **`db`** olmalı, compose servis adı |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `db` ve `backup` servisleri bunları kullanır; **`DATABASE_URL` ile birebir aynı olmalı** |
| `JWT_SECRET` | Uzun ve rastgele: `openssl rand -hex 32` |
| `MONITOR_SYSTEM_KEY` | Aynı şekilde rastgele üret |
| `APP_URL` | `https://eyeon.site` — e-posta doğrulama linkleri ve CORS bunun üzerinden kurulur |
| `ALLOWED_ORIGIN` | Genelde gereksiz; boş bırakılırsa `APP_URL` kullanılır |
| `SMTP_*` | E-posta doğrulama ve şifre sıfırlama için zorunlu |
| `BACKUP_RETENTION_DAYS` / `BACKUP_INTERVAL_HOURS` | Varsayılan 14 gün / 24 saat |

> **Önemli:** `DB_PASSWORD`'ü **ilk `docker compose up`'tan önce** güçlü bir
> değere çek. Postgres şifreyi yalnızca volume ilk oluşturulurken uygular;
> sonradan değiştirmek `ALTER USER` gerektirir ve `DATABASE_URL`'i de
> güncellemeyi unutursan uygulama veritabanına bağlanamaz.

## 3. TLS sertifikalarını yerleştir

nginx sertifikaları şu iki dosyadan okur (bunlar da gitignore'da):

```
nginx/certs/eyeonsite.pem   # fullchain
nginx/certs/eyeonsite.key   # private key
```

Let's Encrypt ile sıfırdan almak için (80 portu boşken):

```bash
sudo certbot certonly --standalone -d eyeon.site -d www.eyeon.site
sudo mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/eyeon.site/fullchain.pem nginx/certs/eyeonsite.pem
sudo cp /etc/letsencrypt/live/eyeon.site/privkey.pem   nginx/certs/eyeonsite.key
```

> Sertifikalar 90 günde bir yenilenir. Yenileme sonrası dosyaları tekrar
> kopyalayıp `docker compose restart nginx` çalıştıracak bir cron/deploy
> hook'u kurmadan bırakma — aksi halde üç ay sonra site sertifika hatası verir.

## 4. Ayağa kaldır

```bash
docker compose up -d --build
docker compose logs -f app
```

Beklenen çıktı:

```
🚀  Your database is now in sync with your Prisma schema
Server listening on http://0.0.0.0:3000 in PRODUCTION mode
Pinger loop started (parallel mode)
```

Şema `prisma db push` ile container açılışında otomatik uygulanır; ayrı bir
migration adımı yoktur. `db` servisinin healthcheck'i sayesinde `app` ve
`backup`, veritabanı hazır olana kadar bekler.

## 5. Doğrulama

```bash
docker compose ps                                   # app, db, nginx, backup → Up
curl -I https://eyeon.site                          # 200
docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" -c '\dt'
```

Tablo listesinde `User`, `Monitor`, `ApiKey`, `AuditLog` görünmeli.

## 6. İlk admin kullanıcısı

Arayüzden kayıt ol, doğrulama e-postasındaki linke tıkla, sonra rolü yükselt:

```bash
docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" \
  -c "UPDATE \"User\" SET role='SYSTEM_ADMIN' WHERE email='seninmailin@ornek.com';"
```

SMTP henüz çalışmıyorsa doğrulamayı elle geçebilirsin:

```bash
docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" \
  -c "UPDATE \"User\" SET \"emailVerified\"=true WHERE email='seninmailin@ornek.com';"
```

## 7. Yedekleme

`backup` servisi açılışta bir kez, sonra `BACKUP_INTERVAL_HOURS` aralığıyla
`pg_dump` alır ve `db_backups` volume'üne yazar; retention süresini geçen
dump'ları siler.

```bash
docker compose exec backup ls -lh /backups
```

> Volume, veritabanıyla **aynı sunucuda** duruyor — bu tek başına yedek
> sayılmaz. Disk ya da sunucu kaybında dump'lar da gider. `db_backups`
> içeriğini restic/rclone gibi bir araçla off-site bir hedefe (S3, B2, başka
> bir sunucu) senkronlamadan kurulumu tamamlanmış sayma.

Geri yükleme:

```bash
gunzip -c /path/to/uptimemonitor-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"
```

## 8. Güncelleme

```bash
git pull
docker compose up -d --build
```

Yeni şema değişiklikleri açılışta otomatik uygulanır. Şema değiştiren bir
sürüme geçmeden önce elle bir yedek al:

```bash
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > pre-deploy-$(date +%F).sql.gz
```

## Notlar

- `db` dışarıya port açmaz; yalnızca compose ağı üzerinden erişilir.
- `app` de port yayınlamaz — trafiğin tek girişi nginx'tir (80 → 443 yönlendirme,
  HSTS ve CSP dahil güvenlik başlıkları nginx.conf'ta).
- Monitörlerin özel/iç IP'leri (10.x, 192.168.x, 127.x) kontrol etmesi
  SSRF koruması nedeniyle varsayılan olarak kapalıdır. Kendi iç ağını izlemek
  istersen `.env`'de `ALLOW_PRIVATE_TARGETS=true` yap.
