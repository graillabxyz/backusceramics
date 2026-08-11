CREATE TABLE "PosWeeklyCloseout" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "grossSubtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "netTotal" INTEGER NOT NULL DEFAULT 0,
    "voidedSaleCount" INTEGER NOT NULL DEFAULT 0,
    "voidedTotal" INTEGER NOT NULL DEFAULT 0,
    "pendingSaleCount" INTEGER NOT NULL DEFAULT 0,
    "pendingTotal" INTEGER NOT NULL DEFAULT 0,
    "paymentBreakdown" TEXT,
    "categoryBreakdown" TEXT,
    "operatorBreakdown" TEXT,
    "dailyBreakdown" TEXT NOT NULL DEFAULT '[]',
    "dailyCashBreakdown" TEXT NOT NULL DEFAULT '[]',
    "missingDailyCloseouts" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosWeeklyCloseout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosWeeklyCloseout_weekStart_key" ON "PosWeeklyCloseout"("weekStart");
CREATE INDEX "PosWeeklyCloseout_weekStart_idx" ON "PosWeeklyCloseout"("weekStart");
CREATE INDEX "PosWeeklyCloseout_weekEnd_idx" ON "PosWeeklyCloseout"("weekEnd");
CREATE INDEX "PosWeeklyCloseout_closedById_idx" ON "PosWeeklyCloseout"("closedById");
CREATE INDEX "PosWeeklyCloseout_closedAt_idx" ON "PosWeeklyCloseout"("closedAt");

ALTER TABLE "PosWeeklyCloseout" ADD CONSTRAINT "PosWeeklyCloseout_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PosWeeklyCloseout" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PosWeeklyCloseout" FROM anon, authenticated;
