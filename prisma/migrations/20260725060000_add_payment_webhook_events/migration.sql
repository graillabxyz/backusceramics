CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'XENDIT',
  "event" TEXT,
  "status" TEXT,
  "paymentSessionId" TEXT,
  "paymentReference" TEXT,
  "saleId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentWebhookEvent_provider_receivedAt_idx"
ON "PaymentWebhookEvent"("provider", "receivedAt");

CREATE INDEX "PaymentWebhookEvent_paymentSessionId_idx"
ON "PaymentWebhookEvent"("paymentSessionId");

CREATE INDEX "PaymentWebhookEvent_paymentReference_idx"
ON "PaymentWebhookEvent"("paymentReference");

CREATE INDEX "PaymentWebhookEvent_saleId_idx"
ON "PaymentWebhookEvent"("saleId");

ALTER TABLE "public"."PaymentWebhookEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."PaymentWebhookEvent" FROM anon, authenticated;
