ALTER TABLE "PromoCode"
ADD COLUMN "posEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PromoRedemption"
DROP CONSTRAINT IF EXISTS "PromoRedemption_channel_check";

ALTER TABLE "PromoRedemption"
ADD CONSTRAINT "PromoRedemption_channel_check"
CHECK ("channel" IN ('SHOP', 'CLASSES', 'POS'));
