import assert from "node:assert/strict"
import test from "node:test"
import { calculateCeramicShipping } from "../lib/shop-shipping"
import {
  extractBookingIds,
  getWebhookPaymentSessionId,
  getWebhookReference,
  getWebhookStatus,
  hasExplicitPosIdentity,
  mapInvoiceStatusToBookingStatus,
  mapInvoiceStatusToPosSaleStatus,
} from "../lib/xendit-webhook"
import { isMatchingXenditClassPayment } from "../lib/xendit-booking-reconciliation"

test("class payment callbacks are not mistaken for POS callbacks", () => {
  const payload = {
    event: "payment_session.completed",
    data: {
      id: "ps-class-session",
      metadata: {
        booking_ids: "booking-1,booking-2",
        booking_reference: "class_123",
      },
    },
  }

  assert.equal(getWebhookStatus(payload), "PAID")
  assert.equal(hasExplicitPosIdentity(payload), false)
  assert.deepEqual(extractBookingIds(payload), ["booking-1", "booking-2"])
  assert.equal(mapInvoiceStatusToBookingStatus(getWebhookStatus(payload)), "CONFIRMED")
})

test("current Xendit payment session webhook identifies the booking session and reference", () => {
  const payload = {
    event: "payment_session.completed",
    data: {
      payment_session_id: "ps-661f87c614802d6c402cd82d",
      reference_id: "bc_123_kids-workshop",
      session_type: "PAY",
      currency: "IDR",
      status: "COMPLETED",
    },
  }

  assert.equal(getWebhookStatus(payload), "PAID")
  assert.equal(getWebhookPaymentSessionId(payload), "ps-661f87c614802d6c402cd82d")
  assert.equal(getWebhookReference(payload), "bc_123_kids-workshop")
  assert.equal(mapInvoiceStatusToBookingStatus(getWebhookStatus(payload)), "CONFIRMED")
})

test("status reconciliation requires the stored Xendit session and reference to match", () => {
  const expected = {
    paymentSessionId: "ps-661f87c614802d6c402cd82d",
    paymentReference: "bc_123_kids-workshop",
    remotePaymentSessionId: "ps-661f87c614802d6c402cd82d",
    remoteReference: "bc_123_kids-workshop",
    remoteSessionType: "PAY",
    remoteCurrency: "IDR",
  }

  assert.equal(isMatchingXenditClassPayment(expected), true)
  assert.equal(isMatchingXenditClassPayment({ ...expected, remoteReference: "bc_someone_else" }), false)
  assert.equal(isMatchingXenditClassPayment({ ...expected, remotePaymentSessionId: "ps-other-session" }), false)
})

test("online shop and POS payment callbacks have explicit sale identity", () => {
  assert.equal(hasExplicitPosIdentity({ reference_id: "shop_123" }), true)
  assert.equal(hasExplicitPosIdentity({ reference_id: "pos_123" }), true)
  assert.equal(hasExplicitPosIdentity({ data: { metadata: { pos_sale_id: "sale-1" } } }), true)
  assert.equal(mapInvoiceStatusToPosSaleStatus(getWebhookStatus({ event: "payment-session.completed" })), "PAID")
  assert.equal(mapInvoiceStatusToPosSaleStatus("expired"), "CANCELLED")
})

test("protected cup carton is never smaller than the cushioned piece", () => {
  const quote = calculateCeramicShipping([{
    id: "cup-1",
    name: "Cup",
    category: "CUPS",
    quantity: 1,
    weightGrams: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
  }], "US")

  assert.equal(quote.usedProductDefaults, true)
  assert.ok(quote.packageLengthCm >= 22)
  assert.ok(quote.packageWidthCm >= 20)
  assert.ok(quote.packageHeightCm >= 20)
  assert.equal(quote.volumetricWeightKg, 2.08)
  assert.equal(quote.chargeableWeightKg, 2.5)
})

test("shipping uses measured dimensions and official domestic/international divisors", () => {
  const product = {
    id: "cup-2",
    name: "Measured cup",
    category: "CUPS",
    quantity: 1,
    weightGrams: 500,
    lengthCm: 12,
    widthCm: 11,
    heightCm: 14,
  }
  const domestic = calculateCeramicShipping([product], "ID")
  const international = calculateCeramicShipping([product], "FR")

  assert.equal(domestic.usedProductDefaults, false)
  assert.equal(international.usedProductDefaults, false)
  assert.ok(domestic.volumetricWeightKg < international.volumetricWeightKg)
  assert.equal(domestic.countryCode, "ID")
  assert.equal(international.countryCode, "FR")
})

test("unsupported destinations and oversize parcels are rejected", () => {
  assert.throws(() => calculateCeramicShipping([], "US"), /at least one product/)
  assert.throws(() => calculateCeramicShipping([{
    id: "lamp-1",
    name: "Oversize lamp",
    category: "LAMPS",
    quantity: 1,
    weightGrams: 2_000,
    lengthCm: 160,
    widthCm: 40,
    heightCm: 40,
  }], "US"), /too large/)
})
