ALTER TABLE "PosSaleItem"
  ADD COLUMN "unitCostSnapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "costTotal" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MenuIngredient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "packageCost" INTEGER NOT NULL,
  "packageQuantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuRecipeIngredient" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "MenuRecipeIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuWasteEntry" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCostSnapshot" INTEGER NOT NULL,
  "totalCost" INTEGER NOT NULL,
  "businessDate" TEXT NOT NULL,
  "reason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuWasteEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuIngredient_normalizedName_key" ON "MenuIngredient"("normalizedName");
CREATE INDEX "MenuIngredient_active_name_idx" ON "MenuIngredient"("active", "name");
CREATE UNIQUE INDEX "MenuRecipeIngredient_productId_ingredientId_key" ON "MenuRecipeIngredient"("productId", "ingredientId");
CREATE INDEX "MenuRecipeIngredient_ingredientId_idx" ON "MenuRecipeIngredient"("ingredientId");
CREATE INDEX "MenuWasteEntry_businessDate_idx" ON "MenuWasteEntry"("businessDate");
CREATE INDEX "MenuWasteEntry_productId_businessDate_idx" ON "MenuWasteEntry"("productId", "businessDate");
CREATE INDEX "MenuWasteEntry_createdById_idx" ON "MenuWasteEntry"("createdById");

ALTER TABLE "MenuRecipeIngredient" ADD CONSTRAINT "MenuRecipeIngredient_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuRecipeIngredient" ADD CONSTRAINT "MenuRecipeIngredient_ingredientId_fkey"
  FOREIGN KEY ("ingredientId") REFERENCES "MenuIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuWasteEntry" ADD CONSTRAINT "MenuWasteEntry_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuWasteEntry" ADD CONSTRAINT "MenuWasteEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MenuIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuRecipeIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuWasteEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MenuIngredient" FROM anon, authenticated;
REVOKE ALL ON TABLE "MenuRecipeIngredient" FROM anon, authenticated;
REVOKE ALL ON TABLE "MenuWasteEntry" FROM anon, authenticated;
