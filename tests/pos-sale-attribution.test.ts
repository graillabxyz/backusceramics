import assert from "node:assert/strict"
import test from "node:test"
import { getPosSaleAttribution } from "../lib/pos-sale-attribution"

test("public website purchases are attributed to online sale", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "sale-online",
    operatorId: null,
    operator: null,
    paymentMethod: "ONLINE",
    paymentReference: "shop_123",
    paymentSessionId: "ps-123",
    notes: "[online-shop] Public online shop checkout",
  }), { key: "online-sale", label: "Online sale" })
})

test("public payment links remain online sales even when an admin created the link", () => {
  assert.deepEqual(getPosSaleAttribution({
    id: "sale-link",
    operatorId: "owner-id",
    operator: { name: "David", email: "owner@example.com" },
    paymentMethod: "ONLINE",
    paymentReference: "plink_123",
    notes: "[online-shop] [payment-link] Shipping payment",
  }), { key: "online-sale", label: "Online sale" })
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
