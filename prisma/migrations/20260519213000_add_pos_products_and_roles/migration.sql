-- Promote the studio owner account into the top-level admin role.
UPDATE "User"
SET "role" = 'OWNER'
WHERE lower("email") = 'backusceramics@gmail.com';

-- Products entered through the point of sale live separately from the current
-- static shop data and can later be selectively surfaced in the public shop.
CREATE TABLE "PosProduct" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "showInShop" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosProduct_slug_key" ON "PosProduct"("slug");
CREATE INDEX "PosProduct_status_idx" ON "PosProduct"("status");
CREATE INDEX "PosProduct_showInShop_idx" ON "PosProduct"("showInShop");
CREATE INDEX "PosProduct_category_idx" ON "PosProduct"("category");

ALTER TABLE "PosProduct"
ADD CONSTRAINT "PosProduct_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
