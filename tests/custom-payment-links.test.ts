import assert from "node:assert/strict"
import test from "node:test"
import { getPaymentLinkStatus, parsePaymentLinkInput } from "../lib/custom-payment-links"

test("payment links require a bounded server-side amount", () => {
  assert.match(parsePaymentLinkInput({ title: "Shipping", amount: 0, purpose: "SHIPPING" }).error, /Amount/)
  assert.equal(parsePaymentLinkInput({ title: "Shipping", amount: 250000, purpose: "SHIPPING" }).error, "")
})

test("paid sale state takes precedence over link expiry", () => {
  assert.equal(getPaymentLinkStatus({
    status: "ACTIVE",
    expiresAt: "2020-01-01T00:00:00.000Z",
    sales: [{ status: "PAID" }],
  }), "PAID")
})

test("active links become expired after their deadline", () => {
  assert.equal(getPaymentLinkStatus({
    status: "ACTIVE",
    expiresAt: "2020-01-01T00:00:00.000Z",
    sales: [{ status: "PENDING_PAYMENT" }],
  }), "EXPIRED")
})
