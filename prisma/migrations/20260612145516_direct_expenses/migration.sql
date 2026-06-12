-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "groupId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DirectParticipant" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DirectParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectParticipant_userId_idx" ON "DirectParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectParticipant_expenseId_userId_key" ON "DirectParticipant"("expenseId", "userId");

-- CreateIndex
CREATE INDEX "Expense_deletedAt_date_idx" ON "Expense"("deletedAt", "date");

-- AddForeignKey
ALTER TABLE "DirectParticipant" ADD CONSTRAINT "DirectParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectParticipant" ADD CONSTRAINT "DirectParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
