-- ############################################################################
-- PLACEHOLDER — bu migration HENUZ URETILMEDI.
--
-- Icerigini uretmek icin (veritabanina baglanmaz, SQL'i dogrudan semadan uretir):
--
--   npx prisma migrate diff \
--     --from-empty \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script > prisma/migrations/20260908000000_init/migration.sql
--
-- Komut bu dosyanin uzerine yazar ve asagidaki guvenlik durdurucusu kaybolur.
--
-- Asagidaki blok bilerek konuldu: dosya bu haliyle bir veritabanina
-- uygulanirsa, sessizce "basarili" sayilip bos bir semayi uygulanmis gibi
-- isaretlemek yerine yuksek sesle hata versin.
-- ############################################################################

DO $$
BEGIN
  RAISE EXCEPTION
    'Init migration henuz uretilmedi. Bkz. prisma/migrations/20260908000000_init/migration.sql icindeki komut.';
END $$;
