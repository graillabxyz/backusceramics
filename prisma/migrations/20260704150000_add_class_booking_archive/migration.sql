ALTER TABLE "ClassBooking" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ClassBooking_status_archivedAt_idx" ON "ClassBooking"("status", "archivedAt");
