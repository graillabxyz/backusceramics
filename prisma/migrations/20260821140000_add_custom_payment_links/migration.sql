CREATE TABLE "CustomPaymentLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" INTEGER NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'CUSTOM_ORDER',
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "checkoutUrl" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "openedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomPaymentLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PosSale" ADD COLUMN "paymentLinkId" TEXT;

CREATE UNIQUE INDEX "CustomPaymentLink_token_key" ON "CustomPaymentLink"("token");
CREATE INDEX "CustomPaymentLink_status_expiresAt_idx" ON "CustomPaymentLink"("status", "expiresAt");
CREATE INDEX "CustomPaymentLink_createdById_createdAt_idx" ON "CustomPaymentLink"("createdById", "createdAt");
CREATE INDEX "PosSale_paymentLinkId_idx" ON "PosSale"("paymentLinkId");

ALTER TABLE "CustomPaymentLink" ADD CONSTRAINT "CustomPaymentLink_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_paymentLinkId_fkey"
  FOREIGN KEY ("paymentLinkId") REFERENCES "CustomPaymentLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomPaymentLink" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CustomPaymentLink" FROM anon, authenticated;
