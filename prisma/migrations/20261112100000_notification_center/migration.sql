-- Merkezi bildirim yonetimi: etiketler, ekipler, kanallar, kurallar, gonderim
-- gecmisi. Monitor/lokasyon uzerindeki eski kanal alanlari SILINMEZ; uygulama
-- ilk acilista bunlari kanal+kurala tasir (Workspace.notificationsMigratedAt)
-- ve sonrasinda bu alanlari okumaz.

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "notificationsMigratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#71717a',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "events" TEXT[],
    "allMonitors" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruleId" TEXT,
    "channelId" TEXT,
    "monitorId" TEXT,
    "groupId" TEXT,
    "subject" TEXT,
    "channelName" TEXT,
    "event" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable (implicit many-to-many)
CREATE TABLE "_MonitorToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MonitorToTag_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_NotificationRuleToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_NotificationRuleToTag_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_MonitorToNotificationRule" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MonitorToNotificationRule_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_MonitorGroupToNotificationRule" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MonitorGroupToNotificationRule_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE TABLE "_NotificationChannelToNotificationRule" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_NotificationChannelToNotificationRule_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");
CREATE UNIQUE INDEX "Team_workspaceId_name_key" ON "Team"("workspaceId", "name");
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
CREATE INDEX "NotificationChannel_workspaceId_idx" ON "NotificationChannel"("workspaceId");
CREATE INDEX "NotificationRule_workspaceId_idx" ON "NotificationRule"("workspaceId");
CREATE INDEX "NotificationLog_workspaceId_createdAt_idx" ON "NotificationLog"("workspaceId", "createdAt");
CREATE INDEX "_MonitorToTag_B_index" ON "_MonitorToTag"("B");
CREATE INDEX "_NotificationRuleToTag_B_index" ON "_NotificationRuleToTag"("B");
CREATE INDEX "_MonitorToNotificationRule_B_index" ON "_MonitorToNotificationRule"("B");
CREATE INDEX "_MonitorGroupToNotificationRule_B_index" ON "_MonitorGroupToNotificationRule"("B");
CREATE INDEX "_NotificationChannelToNotificationRule_B_index" ON "_NotificationChannelToNotificationRule"("B");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationChannel" ADD CONSTRAINT "NotificationChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationChannel" ADD CONSTRAINT "NotificationChannel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_MonitorToTag" ADD CONSTRAINT "_MonitorToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MonitorToTag" ADD CONSTRAINT "_MonitorToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_NotificationRuleToTag" ADD CONSTRAINT "_NotificationRuleToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_NotificationRuleToTag" ADD CONSTRAINT "_NotificationRuleToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MonitorToNotificationRule" ADD CONSTRAINT "_MonitorToNotificationRule_A_fkey" FOREIGN KEY ("A") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MonitorToNotificationRule" ADD CONSTRAINT "_MonitorToNotificationRule_B_fkey" FOREIGN KEY ("B") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MonitorGroupToNotificationRule" ADD CONSTRAINT "_MonitorGroupToNotificationRule_A_fkey" FOREIGN KEY ("A") REFERENCES "MonitorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MonitorGroupToNotificationRule" ADD CONSTRAINT "_MonitorGroupToNotificationRule_B_fkey" FOREIGN KEY ("B") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_NotificationChannelToNotificationRule" ADD CONSTRAINT "_NotificationChannelToNotificationRule_A_fkey" FOREIGN KEY ("A") REFERENCES "NotificationChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_NotificationChannelToNotificationRule" ADD CONSTRAINT "_NotificationChannelToNotificationRule_B_fkey" FOREIGN KEY ("B") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
