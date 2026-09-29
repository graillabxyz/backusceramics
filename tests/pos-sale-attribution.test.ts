import assert from "node:assert/strict"
import test from "node:test"
import { getPosSaleAttribution } from "../lib/pos-sale-attribution"

test("public website purchases are attributed to the website channel", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "sale-online",
    operatorId: null,
    operator: null,
    paymentMethod: "ONLINE",
    paymentReference: "shop_123",
    paymentSessionId: "ps-123",
    notes: "[online-shop] Public online shop checkout",
  }), { key: "channel:WEBSITE", label: "Website shop" })
})

test("public payment links have their own channel even when an admin created the link", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "sale-link",
    operatorId: "owner-id",
    operator: { name: "David", email: "owner@example.com" },
    paymentMethod: "ONLINE",
    paymentReference: "plink_123",
    notes: "[online-shop] [payment-link] Shipping payment",
  }), { key: "channel:PAYMENT_LINK", label: "Payment link" })
})

test("gift voucher purchases are attributed to the gift card channel", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "sale-gift",
    operatorId: null,
    operator: null,
    paymentMethod: "ONLINE",
    paymentReference: "gift_123",
    notes: "[gift-voucher] Cash gift card",
  }), { key: "channel:GIFT_VOUCHER", label: "Gift card" })
})

test("staff sales are attributed to the named POS operator", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "sale-staff",
    operatorId: "atty-id",
    operator: { name: "Atty", email: "atty@example.com" },
    paymentMethod: "CASH",
  }), { key: "atty-id", label: "Atty" })
})

test("legacy unattributed sales expose a transaction reference", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "cm-sale-legacy-12345678",
    operatorId: null,
    operator: null,
    paymentMethod: "CASH",
    paymentReference: "legacy-register-42",
  }), {
    key: "unassigned:cm-sale-legacy-12345678",
    label: "Unassigned sale · legacy-register-42",
  })
})
