ALTER TABLE "PosSale" ADD COLUMN "voidedById" TEXT;
ALTER TABLE "PosSale" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "PosSale" ADD COLUMN "voidReason" TEXT;

CREATE INDEX "PosSale_voidedById_idx" ON "PosSale"("voidedById");

ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
