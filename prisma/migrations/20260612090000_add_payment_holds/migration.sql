ALTER TABLE "ClassBooking"
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "paymentSessionId" TEXT,
ADD COLUMN "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE INDEX "ClassBooking_paymentReference_idx" ON "ClassBooking"("paymentReference");
CREATE INDEX "ClassBooking_paymentSessionId_idx" ON "ClassBooking"("paymentSessionId");
CREATE INDEX "ClassBooking_status_holdExpiresAt_idx" ON "ClassBooking"("status", "holdExpiresAt");
