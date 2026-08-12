CREATE TABLE "PosCashOut" (
  "id" TEXT NOT NULL,
  "fundingSource" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "businessDate" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "staffMemberId" TEXT,
  "reimbursedAt" TIMESTAMP(3),
  "reimbursedBusinessDate" TEXT,
  "reimbursementMethod" TEXT,
  "reimbursementNote" TEXT,
  "reimbursedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "voidedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PosCashOut_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PosCloseout" ADD COLUMN "registerCashOuts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PosWeeklyCloseout" ADD COLUMN "registerCashOuts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PosWeeklyCloseout" ADD COLUMN "staffFundedPurchases" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PosWeeklyCloseout" ADD COLUMN "staffReimbursements" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PosWeeklyCloseout" ADD COLUMN "outstandingStaffDebt" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PosCashOut_businessDate_fundingSource_idx" ON "PosCashOut"("businessDate", "fundingSource");
CREATE INDEX "PosCashOut_staffMemberId_reimbursedAt_voidedAt_idx" ON "PosCashOut"("staffMemberId", "reimbursedAt", "voidedAt");
CREATE INDEX "PosCashOut_reimbursedBusinessDate_reimbursementMethod_idx" ON "PosCashOut"("reimbursedBusinessDate", "reimbursementMethod");
CREATE INDEX "PosCashOut_createdById_idx" ON "PosCashOut"("createdById");
CREATE INDEX "PosCashOut_voidedAt_idx" ON "PosCashOut"("voidedAt");

ALTER TABLE "PosCashOut" ADD CONSTRAINT "PosCashOut_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosCashOut" ADD CONSTRAINT "PosCashOut_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosCashOut" ADD CONSTRAINT "PosCashOut_reimbursedById_fkey" FOREIGN KEY ("reimbursedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosCashOut" ADD CONSTRAINT "PosCashOut_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PosCashOut" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PosCashOut" FROM anon, authenticated;
