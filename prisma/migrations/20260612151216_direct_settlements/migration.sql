-- AlterTable
ALTER TABLE "Settlement" ALTER COLUMN "groupId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Settlement_senderId_receiverId_idx" ON "Settlement"("senderId", "receiverId");
