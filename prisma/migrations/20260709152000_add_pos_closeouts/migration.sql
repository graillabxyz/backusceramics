CREATE TABLE "PosCloseout" (
    "id" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
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
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosCloseout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosCloseout_businessDate_key" ON "PosCloseout"("businessDate");
CREATE INDEX "PosCloseout_businessDate_idx" ON "PosCloseout"("businessDate");
CREATE INDEX "PosCloseout_closedById_idx" ON "PosCloseout"("closedById");
CREATE INDEX "PosCloseout_closedAt_idx" ON "PosCloseout"("closedAt");

ALTER TABLE "PosCloseout" ADD CONSTRAINT "PosCloseout_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
