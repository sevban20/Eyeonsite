# UptimeSaaS (Eyeon.site) — Proje Planı: Eksikler ve Özellik Yol Haritası

*Hazırlanma tarihi: 2 Eylül 2026*
*Kapsam: `uptimesaas---monitoring-&-status-pages` kod tabanının incelenmesine dayanır (server.ts, prisma/schema.prisma, src/components/*)*

## 1. Mevcut Durum Özeti

Proje; React + Vite frontend, Express + Prisma + PostgreSQL backend ve Socket.io ile gerçek zamanlı güncellemelere sahip olgun bir uptime monitoring / status page SaaS'ıdır. Halihazırda çalışan özellikler: HTTP/TCP/PING/HEARTBEAT monitör tipleri, SSL sertifika ve DNS takibi, bakım pencereleri, monitör grupları, workspace + üye yönetimi, herkese açık status page'ler, çok kanallı bildirimler (e-posta, Slack, Discord, Teams, Zoom, Telegram, generic webhook), SSRF koruması, rate limiting, brute-force kilidi, e-posta doğrulama/şifre sıfırlama, admin paneli ve iki dilli (TR/EN) arayüz.

Bu belge, mevcut kod tabanında **bulunmayan** veya **eksik kalan** noktaları önceliklendirip fazlara bölerek bir yol haritası sunar.

---

## 2. Öncelik Fazları

### FAZ 1 — Kritik Altyapı ve Güvenlik (önce bu yapılmalı)

Bu faz, ürünün production'da güvenle büyümesi için önkoşuldur; özellik eklemekten önce gelmelidir.

| # | Konu | Neden Kritik | Efor |
|---|------|---------------|------|
| 1.1 | **Otomatik test paketi kurulumu** (unit + entegrasyon) | Kod tabanında hiç test yok; her değişiklik regresyon riski taşıyor. `server.ts` tek dosyada ~2000 satır — önce pinger/alert mantığı ve auth akışları için testler yazılmalı (Vitest/Jest önerilir). | L |
| 1.2 | **CI/CD pipeline** (GitHub Actions) | Test, lint (`tsc --noEmit` zaten var), build ve Docker image push adımlarını otomatikleştirir. Şu an tamamen manuel deploy var. | M |
| 1.3 | **Kalıcı audit log** | `/api/admin/logs` şu an sadece bellekte tutulan geçici debug buffer'ı dönüyor. Gerçek bir `AuditLog` Prisma modeli eklenip kullanıcı girişleri, monitör silme, plan değişikliği gibi olaylar kalıcı loglanmalı. | M |
| 1.4 | **2FA / TOTP desteği** | `User` modelinde hiç ilgili alan yok. Özellikle admin ve ödeme yapan kullanıcılar için hesap güvenliğinde büyük boşluk. | M |
| 1.5 | **API key / personal access token** | Harici entegrasyon (CI/CD'den monitör oluşturma, Terraform, script) için programatik erişim yok. Yeni `ApiKey` modeli + `authenticateApiKey` middleware gerekir. | M |
| 1.6 | **Veritabanı yedekleme stratejisi** | `docker-compose.yml`'de yedekleme yok; Postgres volume'ü tek nokta arıza. Otomatik `pg_dump` cron + off-site depolama (S3 vb.) eklenmeli. | S |
| 1.7 | **OpenAPI/Swagger dokümantasyonu** | `.env.example`'da OAuth "altyapı hazır" notu var ama gerçek route yok; genel olarak API dokümante değil. 1.5 ile birlikte ele alınabilir. | S |

### FAZ 2 — Status Page ve Incident Management (rekabetçilik için en görünür alan)

Rakip ürünlerle (Better Uptime, UptimeRobot, Statuspage.io) en çok fark yaratan alan burasıdır; status page şu an sadece basit bir monitör listesi.

| # | Özellik | Açıklama | Efor |
|---|---------|----------|------|
| 2.1 | **Gerçek Incident modeli** | Yeni `Incident` + `IncidentUpdate` tabloları: başlık, açıklama, "araştırılıyor → tanımlandı → izleniyor → çözüldü" durum akışı, zaman damgalı güncelleme geçmişi. Şu an sadece otomatik up/down var, elle incident açıp not düşme yok. | L |
| 2.2 | **Özel domain desteği** | `PublicStatusPage.slug` yerine/yanında `customDomain` alanı + Nginx/Caddy reverse-proxy + otomatik SSL (Let's Encrypt) entegrasyonu. | M |
| 2.3 | **E-posta/RSS ile status page aboneliği** | Ziyaretçiler incident güncellemelerine abone olabilsin. `Subscriber` modeli + incident güncellemesinde toplu e-posta gönderimi. | M |
| 2.4 | **Şifre korumalı / private status page** | Bazı müşteriler status page'i herkese açık değil, linki bilenlerle paylaşmak ister. Basit şifre veya token bazlı erişim. | S |
| 2.5 | **90 günlük uptime geçmişi görselleştirmesi** | Status page'de gün bazlı yeşil/sarı/kırmızı bar grafiği (çoğu rakipte standart). `PingLog` verisinden günlük agregasyon. | M |
| 2.6 | **Planlı bakım duyurusu (public)** | `MaintenanceWindow` zaten var ama status page'de görünmüyor; ziyaretçilere "yaklaşan bakım" banner'ı eklenmeli. | S |

### FAZ 3 — Bildirim / Alerting Olgunlaşması

| # | Özellik | Açıklama | Efor |
|---|---------|----------|------|
| 3.1 | **SMS bildirimi (Twilio)** | Kritik down durumlarında e-posta/webhook yetmeyebilir; SMS kanalı eklenmeli. | S |
| 3.2 | **Escalation policy / nöbet çizelgesi (on-call)** | "X dakika içinde onaylanmazsa ikinci kişiye bildir" mantığı yok. `EscalationPolicy` + `OnCallSchedule` modelleri gerekir. | L |
| 3.3 | **PagerDuty / Opsgenie entegrasyonu** | Kurumsal müşteriler için standart beklenti; generic webhook üzerinden de yapılabilir ama native entegrasyon güven verir. | M |
| 3.4 | **Bildirim şablonlarının özelleştirilebilmesi** | Mesaj metinleri şu an sabit kodlanmış (`dispatchNotification` içinde). Kullanıcı kendi şablonunu tanımlayabilmeli. | S |
| 3.5 | **Sessize alma / snooze ve bildirim gruplama** | Birden fazla monitör aynı anda düşerse (örn. ağ kesintisi) tek toplu bildirim; ayrıca geçici "mute" seçeneği. | M |
| 3.6 | **Kullanıcı bazlı bildirim tercihleri** | Şu an bildirim ayarları workspace/monitör seviyesinde; bireysel kullanıcı "bana da e-posta at" tercihi ekleyebilmeli (`WorkspaceMember` üzerine bildirim ayarları). | S |

### FAZ 4 — Ekip, Hesap ve Monetizasyon

| # | Özellik | Açıklama | Efor |
|---|---------|----------|------|
| 4.1 | **Salt okunur "Viewer" rolü** | `WorkspaceMember.role` şu an sadece OWNER/ADMIN; müşteriye veya yöneticiye sadece izleme yetkisi verilemiyor. | S |
| 4.2 | **Stripe ile self-serve billing** | `subscriptionPlan` alanı şemada var ama gerçek ödeme akışı yok; planlar admin panelinden elle atanıyor. Stripe Checkout + webhook entegrasyonu, plan bazlı monitör/interval limitleri. | L |
| 4.3 | **Hesap silme / GDPR veri talebi akışı** | Kullanıcının kendi verisini silmesi/indirmesi için self-serve akış yok. | M |
| 4.4 | **Google/GitHub OAuth'un tamamlanması** | Şema ve `.env.example` hazır ama gerçek route/flow implementasyonu yok; "altyapı hazır" notu yanıltıcı olabilir. | M |
| 4.5 | **CAPTCHA / bot koruması** | Login ve register formlarında yok; brute-force kilidi var ama otomatik bot kayıtlarına karşı ek katman faydalı olur. | S |

### FAZ 5 — Gelişmiş Monitoring Yetenekleri

| # | Özellik | Açıklama | Efor |
|---|---------|----------|------|
| 5.1 | **Çoklu bölgeden kontrol (multi-region probing)** | En büyük yapısal sınırlama: pinger tek sunucudan çalışıyor. Bölgesel worker'lar (örn. birden fazla küçük VPS + merkezi API'ye sonuç gönderme) veya üçüncü parti prob ağı entegrasyonu gerekir. Büyük mimari değişiklik. | XL |
| 5.2 | **SSL zincir (chain) doğrulaması** | Şu an sadece leaf sertifika kontrol ediliyor (`checkSSL` fonksiyonu); ara sertifika sorunları yakalanmıyor. | S |
| 5.3 | **Gelişmiş assertion (JSONPath/regex)** | `expectedKeyword` şu an sadece düz string arıyor; JSON API'ler için JSONPath, HTML için regex desteği eklenmeli. | M |
| 5.4 | **Multi-step / senaryo tabanlı kontrol** | Login yapıp bir API akışını uçtan uca test etme (örn. Playwright tabanlı sentetik tarayıcı testi) yok. | XL |
| 5.5 | **Prometheus metrikleri / health-check endpoint'i** | Kendi altyapısını izleyen ekipler için `/metrics` endpoint'i faydalı olur (self-hosted kullanıcılar için özellikle). | S |

---

## 3. Önerilen Uygulama Sırası (özet yol haritası)

1. **Sprint 1-2:** Test altyapısı + CI/CD (1.1, 1.2) — bundan sonrası için güvenlik ağı.
2. **Sprint 3:** Audit log + 2FA (1.3, 1.4) — hesap güvenliği.
3. **Sprint 4-5:** Incident modeli + status page geçmiş grafiği (2.1, 2.5) — en görünür rekabet farkı.
4. **Sprint 6:** API key desteği + basit dokümantasyon (1.5, 1.7).
5. **Sprint 7-8:** Escalation policy + SMS + bildirim şablonları (3.1, 3.2, 3.4).
6. **Sprint 9-10:** Stripe billing + Viewer rolü (4.1, 4.2) — gelir modelini oturtma.
7. **Sonrası:** Özel domain, OAuth tamamlama, multi-region (uzun vadeli, büyük mimari kararlar gerektirir).

Efor tahminleri göreceli: **S** = birkaç gün, **M** = 1-2 hafta, **L** = 2-4 hafta, **XL** = ayları bulan mimari çalışma (ayrı bir teknik tasarım dokümanı gerektirir).

---

## 4. Teknik Notlar

- Yeni modeller (`Incident`, `IncidentUpdate`, `ApiKey`, `AuditLog`, `Subscriber`, `EscalationPolicy`) `prisma/schema.prisma`'ya eklenip migration ile uygulanmalı.
- `server.ts` tek dosyada çok büyümüş (~2000 satır); Faz 1 testleri yazılırken route'ları modüllere (`routes/auth.ts`, `routes/monitors.ts`, `routes/admin.ts` vb.) ayırmak orta vadede bakımı kolaylaştırır — bu bir refactor maddesi olarak Faz 1'e eklenebilir.
- `dispatchNotification` fonksiyonu (server.ts ~1690-1730 satırları) bildirim şablonları ve escalation policy eklenirken merkezi olarak genişletilmeli.
- Multi-region (5.1) için mevcut tek-process pinger döngüsü (`runPinger`) yerine kuyruk tabanlı bir mimari (Redis/BullMQ + bölgesel worker'lar) düşünülmeli; bu köklü bir mimari değişikliktir ve ayrı bir RFC/tasarım dokümanı hak eder.
