// Xendit requires payment sessions to expire at least 10 minutes after creation.
// Keep a buffer for request latency so a valid session never falls below that floor.
export const PAYMENT_SESSION_DURATION_MINUTES = 15

export function getPaymentSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PAYMENT_SESSION_DURATION_MINUTES * 60 * 1000)
}
