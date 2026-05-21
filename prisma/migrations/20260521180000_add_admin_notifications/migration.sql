CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "path" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminNotification_type_idx" ON "AdminNotification"("type");
CREATE INDEX "AdminNotification_readAt_idx" ON "AdminNotification"("readAt");
CREATE INDEX "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");
