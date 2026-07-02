ALTER TABLE "PosProduct"
ADD COLUMN "imageUrls" TEXT,
ADD COLUMN "cafeOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PosProduct_cafeOnly_idx" ON "PosProduct"("cafeOnly");
CREATE INDEX "PosProduct_sortOrder_idx" ON "PosProduct"("sortOrder");

CREATE TABLE "PosSale" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT,
  "total" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "status" TEXT NOT NULL DEFAULT 'PAID',
  "paymentMethod" TEXT NOT NULL DEFAULT 'CARD_MACHINE',
  "paymentReference" TEXT,
  "paymentSessionId" TEXT,
  "receiptEmail" TEXT,
  "receiptSentAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosSaleItem" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "productId" TEXT,
  "nameSnapshot" TEXT NOT NULL,
  "skuSnapshot" TEXT,
  "categorySnapshot" TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineTotal" INTEGER NOT NULL,

  CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosSale_operatorId_idx" ON "PosSale"("operatorId");
CREATE INDEX "PosSale_createdAt_idx" ON "PosSale"("createdAt");
CREATE INDEX "PosSale_status_idx" ON "PosSale"("status");
CREATE INDEX "PosSale_paymentReference_idx" ON "PosSale"("paymentReference");
CREATE INDEX "PosSale_paymentSessionId_idx" ON "PosSale"("paymentSessionId");
CREATE INDEX "PosSaleItem_saleId_idx" ON "PosSaleItem"("saleId");
CREATE INDEX "PosSaleItem_productId_idx" ON "PosSaleItem"("productId");

ALTER TABLE "PosSale"
ADD CONSTRAINT "PosSale_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PosSaleItem"
ADD CONSTRAINT "PosSaleItem_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PosSaleItem"
ADD CONSTRAINT "PosSaleItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
