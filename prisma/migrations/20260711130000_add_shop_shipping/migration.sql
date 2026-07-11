ALTER TABLE "PosProduct"
ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthCm" INTEGER,
ADD COLUMN "widthCm" INTEGER,
ADD COLUMN "heightCm" INTEGER;

ALTER TABLE "PosSale"
ADD COLUMN "shippingAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fulfillmentMethod" TEXT NOT NULL DEFAULT 'PICKUP',
ADD COLUMN "shippingCountry" TEXT,
ADD COLUMN "shippingPostalCode" TEXT,
ADD COLUMN "shippingCity" TEXT,
ADD COLUMN "shippingAddress" TEXT,
ADD COLUMN "shippingQuote" TEXT;
