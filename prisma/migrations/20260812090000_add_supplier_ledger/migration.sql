CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierLedgerEntry" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "businessDate" TEXT NOT NULL,
    "description" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "paymentMethod" TEXT,
    "reference" TEXT,
    "createdById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PosCloseout"
  ADD COLUMN "supplierBillsTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierPaymentsTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierCashPayments" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierNetChange" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierOutstanding" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierBreakdown" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "PosWeeklyCloseout"
  ADD COLUMN "supplierBillsTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierPaymentsTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierNetChange" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierOutstanding" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supplierBreakdown" TEXT NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX "Supplier_normalizedName_key" ON "Supplier"("normalizedName");
CREATE INDEX "Supplier_active_name_idx" ON "Supplier"("active", "name");
CREATE INDEX "Supplier_createdById_idx" ON "Supplier"("createdById");
CREATE INDEX "SupplierLedgerEntry_supplierId_businessDate_idx" ON "SupplierLedgerEntry"("supplierId", "businessDate");
CREATE INDEX "SupplierLedgerEntry_businessDate_entryType_idx" ON "SupplierLedgerEntry"("businessDate", "entryType");
CREATE INDEX "SupplierLedgerEntry_createdById_idx" ON "SupplierLedgerEntry"("createdById");
CREATE INDEX "SupplierLedgerEntry_voidedAt_idx" ON "SupplierLedgerEntry"("voidedAt");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_voidedById_fkey"
FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierLedgerEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Supplier" FROM anon, authenticated;
REVOKE ALL ON TABLE "SupplierLedgerEntry" FROM anon, authenticated;
