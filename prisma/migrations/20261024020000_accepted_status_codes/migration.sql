-- AlterTable
--
-- IF NOT EXISTS bilerek kullanildi: bu kolon, migration dosyasi eksik
-- commit'lendigi icin bazi ortamlarda elle eklenmis olabilir. Prisma'nin
-- urettigi duz ALTER, kolon zaten varsa hata verir ve container acilista
-- dongüye girer. Idempotent hali her iki durumda da sorunsuz calisir.
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "acceptedStatusCodes" TEXT;
