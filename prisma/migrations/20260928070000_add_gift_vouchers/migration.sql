ALTER TABLE "PosSale"
ADD COLUMN IF NOT EXISTS "giftVoucherCodeSnapshot" TEXT,
ADD COLUMN IF NOT EXISTS "giftVoucherAmount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "GiftVoucher" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "classDays" INTEGER,
  "participants" INTEGER NOT NULL DEFAULT 1,
  "initialAmount" INTEGER NOT NULL,
  "remainingAmount" INTEGER NOT NULL DEFAULT 0,
  "remainingClassDays" INTEGER NOT NULL DEFAULT 0,
  "purchaserName" TEXT NOT NULL,
  "purchaserEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "message" TEXT,
  "paymentReference" TEXT NOT NULL,
  "paymentSessionId" TEXT,
  "purchaseSaleId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftVoucher_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftVoucher_type_check" CHECK ("type" IN ('CLASS', 'CASH')),
  CONSTRAINT "GiftVoucher_status_check" CHECK ("status" IN ('PENDING_PAYMENT', 'ACTIVE', 'REDEEMED', 'CANCELLED')),
  CONSTRAINT "GiftVoucher_class_days_check" CHECK ("classDays" IS NULL OR "classDays" IN (1, 3, 6)),
  CONSTRAINT "GiftVoucher_participants_check" CHECK ("participants" BETWEEN 1 AND 12),
  CONSTRAINT "GiftVoucher_amounts_check" CHECK ("initialAmount" > 0 AND "remainingAmount" >= 0),
  CONSTRAINT "GiftVoucher_remaining_days_check" CHECK ("remainingClassDays" >= 0),
  CONSTRAINT "GiftVoucher_purchaseSaleId_fkey" FOREIGN KEY ("purchaseSaleId") REFERENCES "PosSale"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "GiftVoucherRedemption" (
  "id" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "operatorId" TEXT,
  "saleId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "amount" INTEGER NOT NULL DEFAULT 0,
  "classDays" INTEGER NOT NULL DEFAULT 0,
  "participants" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  CONSTRAINT "GiftVoucherRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftVoucherRedemption_type_check" CHECK ("type" IN ('CLASS_DAY', 'CASH')),
  CONSTRAINT "GiftVoucherRedemption_status_check" CHECK ("status" IN ('APPLIED', 'REVERSED')),
  CONSTRAINT "GiftVoucherRedemption_value_check" CHECK ("amount" >= 0 AND "classDays" >= 0 AND "participants" >= 0),
  CONSTRAINT "GiftVoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "GiftVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GiftVoucherRedemption_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GiftVoucherRedemption_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GiftVoucher_code_key" ON "GiftVoucher"("code");
CREATE UNIQUE INDEX "GiftVoucher_token_key" ON "GiftVoucher"("token");
CREATE UNIQUE INDEX "GiftVoucher_paymentReference_key" ON "GiftVoucher"("paymentReference");
CREATE UNIQUE INDEX "GiftVoucher_purchaseSaleId_key" ON "GiftVoucher"("purchaseSaleId");
CREATE INDEX "GiftVoucher_status_type_idx" ON "GiftVoucher"("status", "type");
CREATE INDEX "GiftVoucher_paymentSessionId_idx" ON "GiftVoucher"("paymentSessionId");
CREATE INDEX "GiftVoucher_purchaserEmail_idx" ON "GiftVoucher"("purchaserEmail");
CREATE INDEX "GiftVoucher_recipientEmail_idx" ON "GiftVoucher"("recipientEmail");
CREATE INDEX "GiftVoucherRedemption_voucherId_createdAt_idx" ON "GiftVoucherRedemption"("voucherId", "createdAt");
CREATE INDEX "GiftVoucherRedemption_operatorId_createdAt_idx" ON "GiftVoucherRedemption"("operatorId", "createdAt");
CREATE INDEX "GiftVoucherRedemption_saleId_idx" ON "GiftVoucherRedemption"("saleId");
CREATE INDEX "PosSale_giftVoucherCodeSnapshot_idx" ON "PosSale"("giftVoucherCodeSnapshot");

ALTER TABLE "GiftVoucher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GiftVoucherRedemption" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GiftVoucher" FROM anon, authenticated;
REVOKE ALL ON TABLE "GiftVoucherRedemption" FROM anon, authenticated;
