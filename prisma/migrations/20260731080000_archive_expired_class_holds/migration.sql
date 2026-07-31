ALTER TABLE "ClassHold"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ClassHold_status_endDate_idx"
ON "ClassHold"("status", "endDate");
