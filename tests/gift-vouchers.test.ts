import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateClassGiftVoucherPrice,
  giftVoucherQrPayload,
  getGiftVoucherTitle,
  isGiftVoucherClassDays,
  normalizeGiftVoucherLookup,
} from "../lib/gift-vouchers"
import { buildGiftVoucherPdf } from "../lib/gift-voucher-pdf"

test("prices class gift vouchers per participant", () => {
  assert.equal(calculateClassGiftVoucherPrice(1, 2), 1_300_000)
  assert.equal(calculateClassGiftVoucherPrice(3, 2), 5_000_000)
  assert.equal(calculateClassGiftVoucherPrice(6, 3), 10_500_000)
})

test("accepts only the supported class package lengths", () => {
  assert.equal(isGiftVoucherClassDays(1), true)
  assert.equal(isGiftVoucherClassDays(3), true)
  assert.equal(isGiftVoucherClassDays(6), true)
  assert.equal(isGiftVoucherClassDays(2), false)
})

test("normalizes printed codes and scanned voucher URLs", () => {
  assert.equal(normalizeGiftVoucherLookup(" backus-ab12 "), "BACKUS-AB12")
  assert.equal(normalizeGiftVoucherLookup("https://www.backusceramics.com/gift-cards/v/token_123"), "token_123")
  assert.equal(giftVoucherQrPayload("https://www.backusceramics.com/", "token_123"), "https://www.backusceramics.com/gift-cards/v/token_123")
})

test("describes multi-person class vouchers clearly", () => {
  assert.equal(getGiftVoucherTitle({ type: "CLASS", classDays: 3, participants: 2 }), "Three Day Ceramics Workshop for 2 people")
  assert.equal(getGiftVoucherTitle({ type: "CASH" }), "Backus Ceramics Cash Gift Voucher")
})

test("generates a downloadable PDF containing a QR voucher", async () => {
  const pdf = await buildGiftVoucherPdf({
    code: "BACKUS-TEST123",
    token: "test_token_123",
    type: "CLASS",
    classDays: 1,
    participants: 2,
    initialAmount: 1_300_000,
    recipientName: "Studio Friend",
    message: "Come make something beautiful.",
  }, "https://www.backusceramics.com")
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-")
  assert.ok(pdf.length > 10_000)
})
