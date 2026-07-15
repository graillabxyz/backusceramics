-- Six-digit POS PIN hashes were present on a table that had been exposed to
-- the Supabase Data API. Treat them as compromised and require fresh PINs.
UPDATE "public"."User"
SET
  "posPinHash" = NULL,
  "posPinSetAt" = NULL
WHERE "posPinHash" IS NOT NULL OR "posPinSetAt" IS NOT NULL;
