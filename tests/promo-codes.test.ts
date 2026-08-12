import assert from "node:assert/strict"
import test from "node:test"
import {
  calculatePromoDiscount,
  isValidPromoCodeFormat,
  MINIMUM_DISCOUNTED_PAYMENT_IDR,
  normalizePromoCode,
} from "../lib/promo-codes"

test("normalizes promo codes without accepting unsafe formats", () => {
  assert.equal(normalizePromoCode(" welcome 10 "), "WELCOME10")
  assert.equal(isValidPromoCodeFormat("WELCOME10"), true)
  assert.equal(isValidPromoCodeFormat("NO"), false)
  assert.equal(isValidPromoCodeFormat("BAD.CODE"), false)
})

test("calculates whole-rupiah percentage discounts", () => {
  assert.equal(calculatePromoDiscount({ discountType: "PERCENT", discountValue: 15, maxDiscount: null }, 650_000), 97_500)
})

test("caps percentage discounts", () => {
  assert.equal(calculatePromoDiscount({ discountType: "PERCENT", discountValue: 25, maxDiscount: 100_000 }, 650_000), 100_000)
})

test("calculates fixed discounts", () => {
  assert.equal(calculatePromoDiscount({ discountType: "FIXED", discountValue: 75_000, maxDiscount: null }, 650_000), 75_000)
})

test("never discounts a payable checkout below the Xendit minimum", () => {
  assert.equal(
    calculatePromoDiscount({ discountType: "PERCENT", discountValue: 100, maxDiscount: null }, 650_000),
    650_000 - MINIMUM_DISCOUNTED_PAYMENT_IDR,
  )
  assert.equal(calculatePromoDiscount({ discountType: "FIXED", discountValue: 20_000, maxDiscount: null }, 10_000), 0)
})
