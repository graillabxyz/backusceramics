CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "path" TEXT,
  "referrer" TEXT,
  "pageTitle" TEXT,
  "visitorId" TEXT,
  "sessionId" TEXT,
  "userId" TEXT,
  "productId" TEXT,
  "productSlug" TEXT,
  "productName" TEXT,
  "productCategory" TEXT,
  "workshopId" TEXT,
  "workshopTitle" TEXT,
  "scheduleId" TEXT,
  "source" TEXT,
  "value" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "metadata" TEXT,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_type_idx" ON "AnalyticsEvent"("type");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
CREATE INDEX "AnalyticsEvent_path_idx" ON "AnalyticsEvent"("path");
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX "AnalyticsEvent_visitorId_idx" ON "AnalyticsEvent"("visitorId");
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX "AnalyticsEvent_productSlug_idx" ON "AnalyticsEvent"("productSlug");
CREATE INDEX "AnalyticsEvent_workshopId_idx" ON "AnalyticsEvent"("workshopId");
CREATE INDEX "AnalyticsEvent_source_idx" ON "AnalyticsEvent"("source");

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
