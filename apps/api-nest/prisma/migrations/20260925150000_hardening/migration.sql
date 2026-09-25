-- DropIndex
DROP INDEX "refund_requests_conversation_id_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "locked_until" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_conversation_id_key" ON "refund_requests"("conversation_id");

