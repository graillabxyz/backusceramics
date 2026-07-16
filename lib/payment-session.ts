export const PAYMENT_SESSION_DURATION_MINUTES = 10

export function getPaymentSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PAYMENT_SESSION_DURATION_MINUTES * 60 * 1000)
}
