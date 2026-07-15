-- Application data is accessed through server-side Prisma/API routes. Supabase
-- Auth continues to use the separate auth schema, so public tables should never
-- be available directly through PostgREST.

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrderUpdate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ClassBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ClassSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ClassHold" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PosProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PosSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PosSaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PosCloseout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserNotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ResidencyApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- RLS is the primary boundary. Revoking grants as well provides defense in
-- depth and makes accidental direct client access fail closed.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;

-- Future Prisma tables created by the migration role must not inherit the
-- default Supabase Data API grants. They still need an explicit ENABLE RLS in
-- their creating migration before deployment.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
