-- AlterTable
ALTER TABLE "PublicStatusPage" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "showGroupMembers" BOOLEAN NOT NULL DEFAULT false;

