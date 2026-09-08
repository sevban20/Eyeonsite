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

> **Önemli:** `DB_PASSWORD` ile `DATABASE_URL` içindeki şifre **birebir aynı
> olmalı**. Postgres şifreyi yalnızca volume ilk oluşturulurken uygular;
> sonradan değiştirmek `ALTER USER` gerektirir. Bu yüzden şifreyi ilk
> `docker compose up`'tan önce kesinleştir.
>
> Geliştirme makinesindeki `.env` dosyasında 32 karakterlik rastgele bir şifre
> zaten üretildi; sunucuda **yeni bir tane üret**, geliştirme şifresini taşıma:
> `openssl rand -base64 24 | tr -d '/+=' | head -c 32`

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

Sertifikalar 90 günde bir yenilenir ve bu **otomatikleştirilmiş durumda**:
`scripts/renew-certs.sh` sertifikanın bitimine 30 günden az kaldıysa nginx'i
kısa süreliğine durdurup `certbot renew` çalıştırır, yeni dosyaları
`nginx/certs/`'e kopyalar ve nginx'i geri açar. Certbot hata verse bile nginx
`trap` ile mutlaka geri başlatılır.

Cron'a ekle (haftada bir yeterli):

```bash
chmod +x scripts/renew-certs.sh
sudo crontab -e
# 0 4 * * 1 cd /opt/Eyeonsite && ./scripts/renew-certs.sh >> /var/log/eyeonsite-renew.log 2>&1
```

Kurduktan sonra bir kez elle çalıştırıp çıktısını gör — cron'un sessizce
başarısız olduğunu üç ay sonra öğrenmek istemezsin.

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

Şema, container açılışında `prisma migrate deploy` ile uygulanır: yalnızca
`prisma/migrations/` altındaki, gözden geçirilmiş ve commit'lenmiş SQL
dosyaları sırayla çalışır. Bu komut kendiliğinden hiçbir şey düşürmez ve
uygulananları `_prisma_migrations` tablosunda tutar. `db` servisinin
healthcheck'i sayesinde `app` ve `backup`, veritabanı hazır olana kadar bekler.

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
> sayılmaz. Disk ya da sunucu kaybında dump'lar da gider.

Off-site senkron (rclone ile, hedefi bir kez yapılandırdıktan sonra):

```bash
# 1) rclone kur ve hedefi tanımla (S3, Backblaze B2, Drive, başka bir sunucu...)
sudo apt install -y rclone && rclone config     # hedefe "backup" adını ver

# 2) volume'ün host üzerindeki yolunu bul
docker volume inspect eyeonsite_db_backups --format '{{.Mountpoint}}'

# 3) günlük senkron için cron
sudo crontab -e
# 30 4 * * * rclone sync /var/lib/docker/volumes/eyeonsite_db_backups/_data backup:eyeonsite-db --log-file=/var/log/eyeonsite-rclone.log
```

Kurduktan sonra **bir kez geri yükleme denemesi yap**. Test edilmemiş yedek,
yedek değildir.

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

Bekleyen migration'lar açılışta otomatik uygulanır. Yine de şema değiştiren
bir sürüme geçmeden önce yedek almak iyi bir alışkanlık:

```bash
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > pre-deploy-$(date +%F).sql.gz
```

## 9. Şema değişikliği yapmak

`prisma/schema.prisma`'yı elle değiştirip bırakmak **yetmez** — migration da
üretilmelidir, yoksa CI kırılır ve sunucuda değişiklik hiç uygulanmaz.

```bash
# geliştirme makinende, çalışan bir Postgres varken
npx prisma migrate dev --name aciklayici_bir_ad
```

Bu komut `prisma/migrations/<zaman>_aciklayici_bir_ad/migration.sql` üretir ve
lokal veritabanına uygular. **Üretilen SQL'i commit'lemeden önce oku** — özellikle
`DROP` içeriyorsa, gerçekten kastettiğin şey olduğundan emin ol. Prisma bir
kolonun yeniden adlandırıldığını anlayamaz; "eskisini düşür, yenisini ekle"
olarak üretir ve o SQL prod'da veriyi siler. Böyle durumlarda üretilen dosyayı
elle `ALTER TABLE ... RENAME COLUMN` olacak şekilde düzeltmek gerekir.

### Zaten verisi olan bir veritabanını migration'lara geçirmek

Bu kurulum sıfırdan migration'la başladığı için normalde gerekmez. Ama elinde
`db push` ile oluşturulmuş, verisi olan bir veritabanı varsa `migrate deploy`
"tablolar zaten var" diyerek hata verir. O durumda mevcut durumu başlangıç
noktası olarak işaretle (hiçbir SQL çalıştırmaz, sadece kaydeder):

```bash
docker compose exec app npx prisma migrate resolve --applied 20260908000000_init
```

## Notlar

- `db` dışarıya port açmaz; yalnızca compose ağı üzerinden erişilir.
- `app` de port yayınlamaz — trafiğin tek girişi nginx'tir (80 → 443 yönlendirme,
  HSTS ve CSP dahil güvenlik başlıkları nginx.conf'ta).
- Monitörlerin özel/iç IP'leri (10.x, 192.168.x, 127.x) kontrol etmesi
  SSRF koruması nedeniyle varsayılan olarak kapalıdır. Kendi iç ağını izlemek
  istersen `.env`'de `ALLOW_PRIVATE_TARGETS=true` yap.
