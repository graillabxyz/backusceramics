import assert from "node:assert/strict"
import test from "node:test"
import { getPosCustomItemMetadata, normalizePosCustomItemType } from "../lib/pos-custom-items"

test("recognizes only supported POS custom item types", () => {
  assert.equal(normalizePosCustomItemType("DISCOUNT_BOX"), "DISCOUNT_BOX")
  assert.equal(normalizePosCustomItemType("CLIENT_ORDER"), "CLIENT_ORDER")
  assert.equal(normalizePosCustomItemType("FREE_ITEM"), null)
  assert.equal(normalizePosCustomItemType(null), null)
})

test("client orders remain identifiable in sales and closeout reporting", () => {
  assert.deepEqual(getPosCustomItemMetadata("CLIENT_ORDER"), {
    defaultName: "",
    sku: "CLIENT-ORDER",
    category: "CLIENT_ORDERS",
  })
})
