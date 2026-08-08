ALTER TABLE "UserNotificationPreference"
  ADD COLUMN "morningBriefingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "morningBriefingSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "liveAlertSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "afterHoursPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "openingTimeMinutes" INTEGER NOT NULL DEFAULT 510,
  ADD COLUMN "closingTimeMinutes" INTEGER NOT NULL DEFAULT 1020;

ALTER TABLE "PosSale" ADD COLUMN "fulfilledAt" TIMESTAMP(3);
CREATE INDEX "PosSale_fulfilledAt_idx" ON "PosSale"("fulfilledAt");

ALTER TABLE "PosSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserNotificationPreference" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "PosSale", "UserNotificationPreference" FROM anon, authenticated;
