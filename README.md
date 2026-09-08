# Eyeon.site — Uptime Monitoring & Status Pages

Kendi altyapınızda çalışan uptime izleme ve durum sayfası uygulaması.
HTTP, TCP, ICMP ping ve heartbeat monitörleri; SSL sertifikası ve DNS takibi;
çok kanallı bildirim; herkese açık durum sayfaları.

## Özellikler

- **Monitör tipleri** — HTTP(S) (anahtar kelime doğrulama, özel header ve
  metod), TCP port, ICMP ping, heartbeat (cron/cihaz tarafından çağrılan)
- **Lokasyon (composite) alarmı** — bir grubu tek bir lokasyon gibi ele alır;
  üyelerin bir kısmı düştüğünde *kısmi kesinti*, tamamı düştüğünde *tam
  kesinti* olarak ayrı kanallara bildirir
- **Bildirim kanalları** — e-posta, Slack, Discord, Microsoft Teams, Zoom,
  Telegram, genel webhook
- **SSL ve DNS takibi** — sertifika bitiş uyarısı, DNS çözümleme süresi ve IP
  değişikliği tespiti
- **Durum sayfaları** — herkese açık, kendi slug'ı olan sayfalar
- **Bakım pencereleri** — planlı bakımda alarm üretilmez
- **Güvenlik** — TOTP tabanlı iki faktörlü doğrulama, API anahtarları, kalıcı
  audit log, SSRF koruması, rate limiting, brute-force hesap kilidi
- **Çok kullanıcılı** — workspace ve üye yönetimi
- **İki dilli arayüz** — Türkçe / İngilizce

## Teknoloji

React 19 + Vite + Tailwind (frontend) · Express + Prisma + PostgreSQL
(backend) · Socket.io (gerçek zamanlı güncellemeler) · Docker Compose (dağıtım)

## Sunucuya kurulum

Üretim kurulumunun tamamı **[DEPLOY.md](DEPLOY.md)** içinde: `.env`
yapılandırması, TLS sertifikaları, ilk açılış, doğrulama, yedekleme ve
güncelleme adımları.

```bash
git clone https://github.com/sevban20/Eyeonsite.git && cd Eyeonsite
cp .env.example .env      # doldur — ayrıntılar DEPLOY.md'de
docker compose up -d --build
```

## Geliştirme

**Gereksinimler:** Node.js 22+, çalışan bir PostgreSQL.

```bash
npm install
cp .env.example .env      # en azından DATABASE_URL ve JWT_SECRET
npx prisma generate
npx prisma migrate deploy     # semayi uygula
npm run dev
```

Faydalı komutlar:

```bash
npm run lint    # tsc --noEmit
npm test        # vitest
npm run build   # üretim derlemesi
```

Şemayı değiştirdiğinde migration üretmeyi unutma — CI bunu kontrol ediyor:

```bash
npx prisma migrate dev --name aciklayici_bir_ad
```

Ayrıntılar ve `DROP` içeren migration'larda dikkat edilmesi gerekenler için
[DEPLOY.md](DEPLOY.md#9-şema-değişikliği-yapmak).

## Proje yapısı

```
server.ts          Express API, socket.io ve pinger motoru
lib/               Saf, test edilebilir modüller (güvenlik, doğrulama,
                   TOTP, API anahtarları, audit, composite alarm)
lib/__tests__/     Birim testleri
prisma/schema.prisma
src/               React arayüzü
scripts/           Yedekleme ve sertifika yenileme script'leri
openapi.yaml       API dokümantasyonu
PROJE_PLANI.md     Yol haritası ve bilinen eksikler
DEPLOY.md          Sunucu kurulum ve işletim rehberi
```
