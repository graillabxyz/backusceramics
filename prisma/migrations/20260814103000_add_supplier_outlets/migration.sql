ALTER TABLE "Supplier"
  ADD COLUMN "outletName" TEXT,
  ADD COLUMN "normalizedOutletName" TEXT NOT NULL DEFAULT '';

DROP INDEX "Supplier_normalizedName_key";

CREATE UNIQUE INDEX "Supplier_normalizedName_normalizedOutletName_key"
  ON "Supplier"("normalizedName", "normalizedOutletName");
