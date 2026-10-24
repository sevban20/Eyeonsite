-- CreateTable
CREATE TABLE "_MonitorGroupToPublicStatusPage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MonitorGroupToPublicStatusPage_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MonitorGroupToPublicStatusPage_B_index" ON "_MonitorGroupToPublicStatusPage"("B");

-- AddForeignKey
ALTER TABLE "_MonitorGroupToPublicStatusPage" ADD CONSTRAINT "_MonitorGroupToPublicStatusPage_A_fkey" FOREIGN KEY ("A") REFERENCES "MonitorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MonitorGroupToPublicStatusPage" ADD CONSTRAINT "_MonitorGroupToPublicStatusPage_B_fkey" FOREIGN KEY ("B") REFERENCES "PublicStatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

