-- 600+ monitorde performans: PingLog'da hic indeks yoktu. Dakikada 600 kontrol
-- gunde ~864 bin satir demek; gecmise bakan her sorgu (dashboard ozeti, detay
-- sayfasi, durum sayfasi, uyarilar, log temizligi) tum tabloyu tariyordu.
--
-- NOT: Buyuk bir PingLog tablosunda indeks olusturmak birkac saniye ile birkac
-- dakika surebilir; bu sure boyunca tabloya yazma bekler (pinger bir sonraki
-- turda devam eder). Migration oncesi otomatik yedek zaten aliniyor.

-- Monitor basina zaman araligi sorgulari (gecmis, istatistik, durum sayfasi)
CREATE INDEX IF NOT EXISTS "PingLog_monitorId_timestamp_idx" ON "PingLog"("monitorId", "timestamp");

-- En yeni kayitlar (uyarilar sayfasi) ve eski kayit temizligi
CREATE INDEX IF NOT EXISTS "PingLog_timestamp_idx" ON "PingLog"("timestamp");

-- Workspace / grup bazli monitor listeleri
CREATE INDEX IF NOT EXISTS "Monitor_workspaceId_idx" ON "Monitor"("workspaceId");
CREATE INDEX IF NOT EXISTS "Monitor_groupId_idx" ON "Monitor"("groupId");

-- Pinger her turda aktif bakim pencerelerini sorgular
CREATE INDEX IF NOT EXISTS "MaintenanceWindow_monitorId_idx" ON "MaintenanceWindow"("monitorId");
CREATE INDEX IF NOT EXISTS "MonitorGroup_workspaceId_idx" ON "MonitorGroup"("workspaceId");
