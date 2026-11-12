-- Oturum iptali icin surum sayaci (bkz. User.tokenVersion)
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
