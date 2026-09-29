import assert from "node:assert/strict"
import test from "node:test"
import { getSalesChannel } from "../lib/sales-ledger"

test("classifies direct staff sales as POS", () => {
  assert.equal(getSalesChannel({ operatorId: "staff-1", paymentMethod: "CASH" }), "POS")
})

test("classifies website shop notes as website sales", () => {
  assert.equal(getSalesChannel({ paymentMethod: "ONLINE", notes: "[online-shop] Public checkout" }), "WEBSITE")
})

test("payment link markers take precedence over the general website marker", () => {
  assert.equal(getSalesChannel({
    paymentMethod: "ONLINE",
    paymentLinkId: "link-1",
    notes: "[online-shop] [payment-link] Deposit",
  }), "PAYMENT_LINK")
})

test("gift voucher markers take precedence over other online markers", () => {
  assert.equal(getSalesChannel({
    paymentMethod: "ONLINE",
    paymentLinkId: "link-1",
    notes: "[online-shop] [gift-voucher] Gift purchase",
  }), "GIFT_VOUCHER")
})

test("classifies legacy autonomous online payments as website sales", () => {
  assert.equal(getSalesChannel({
    operatorId: null,
    paymentMethod: "ONLINE",
    paymentSessionId: "ps-1",
  }), "WEBSITE")
})

test("keeps POS-originated online payments in the POS channel", () => {
  assert.equal(getSalesChannel({
    operatorId: "staff-1",
    paymentMethod: "ONLINE",
    paymentSessionId: "ps-1",
  }), "POS")
})
