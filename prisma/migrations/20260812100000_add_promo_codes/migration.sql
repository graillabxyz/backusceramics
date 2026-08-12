ALTER TABLE "PosSale" ADD COLUMN "promoCodeSnapshot" TEXT;

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscount" INTEGER,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxRedemptionsPerUser" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT,
    "customerEmail" TEXT,
    "channel" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "paymentSessionId" TEXT,
    "saleId" TEXT,
    "bookingIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_active_startsAt_expiresAt_idx" ON "PromoCode"("active", "startsAt", "expiresAt");
CREATE INDEX "PromoCode_scope_idx" ON "PromoCode"("scope");
CREATE INDEX "PromoCode_createdById_idx" ON "PromoCode"("createdById");

CREATE UNIQUE INDEX "PromoRedemption_paymentReference_key" ON "PromoRedemption"("paymentReference");
CREATE UNIQUE INDEX "PromoRedemption_saleId_key" ON "PromoRedemption"("saleId");
CREATE INDEX "PromoRedemption_promoCodeId_status_expiresAt_idx" ON "PromoRedemption"("promoCodeId", "status", "expiresAt");
CREATE INDEX "PromoRedemption_userId_promoCodeId_status_idx" ON "PromoRedemption"("userId", "promoCodeId", "status");
CREATE INDEX "PromoRedemption_customerEmail_promoCodeId_status_idx" ON "PromoRedemption"("customerEmail", "promoCodeId", "status");
CREATE INDEX "PromoRedemption_paymentSessionId_idx" ON "PromoRedemption"("paymentSessionId");
CREATE INDEX "PromoRedemption_saleId_idx" ON "PromoRedemption"("saleId");
CREATE INDEX "PosSale_promoCodeSnapshot_idx" ON "PosSale"("promoCodeSnapshot");

ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoRedemption" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PromoCode" FROM anon, authenticated;
REVOKE ALL ON TABLE "PromoRedemption" FROM anon, authenticated;

ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_discountType_check"
  CHECK ("discountType" IN ('PERCENT', 'FIXED'));
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_scope_check"
  CHECK ("scope" IN ('ALL', 'SHOP', 'CLASSES'));
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_values_check"
  CHECK (
    "discountValue" > 0
    AND ("discountType" <> 'PERCENT' OR "discountValue" <= 100)
    AND ("maxDiscount" IS NULL OR "maxDiscount" > 0)
    AND "minSubtotal" >= 0
    AND ("maxRedemptions" IS NULL OR "maxRedemptions" > 0)
    AND "maxRedemptionsPerUser" > 0
    AND ("expiresAt" IS NULL OR "startsAt" IS NULL OR "expiresAt" > "startsAt")
  );
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_channel_check"
  CHECK ("channel" IN ('SHOP', 'CLASSES'));
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_status_check"
  CHECK ("status" IN ('PENDING', 'APPLIED', 'CANCELLED'));
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_amounts_check"
  CHECK ("subtotal" > 0 AND "discountAmount" > 0 AND "discountAmount" < "subtotal");
