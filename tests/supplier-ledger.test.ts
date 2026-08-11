import assert from "node:assert/strict"
import test from "node:test"
import { normalizeSupplierName, summarizeSupplierLedger } from "../lib/supplier-ledger"

test("normalizes supplier names for duplicate prevention", () => {
  assert.equal(normalizeSupplierName("  Bali   Fresh FOOD  "), "bali fresh food")
})

test("supplier balances support accumulated bills and partial payments", () => {
  const summary = summarizeSupplierLedger([
    { supplierId: "food", supplierName: "Food Supplier", entryType: "BILL", amount: 1_200_000 },
    { supplierId: "food", supplierName: "Food Supplier", entryType: "BILL", amount: 800_000 },
    { supplierId: "food", supplierName: "Food Supplier", entryType: "PAYMENT", amount: 500_000 },
    { supplierId: "clay", supplierName: "Clay Supplier", entryType: "BILL", amount: 300_000 },
    { supplierId: "clay", supplierName: "Clay Supplier", entryType: "PAYMENT", amount: 300_000 },
  ])

  assert.equal(summary.billCount, 3)
  assert.equal(summary.billsTotal, 2_300_000)
  assert.equal(summary.paymentCount, 2)
  assert.equal(summary.paymentsTotal, 800_000)
  assert.equal(summary.netChange, 1_500_000)
  assert.deepEqual(summary.breakdown.map((item) => [item.supplierName, item.netChange]), [
    ["Food Supplier", 1_500_000],
    ["Clay Supplier", 0],
  ])
})

test("empty supplier ledger returns zero accounting totals", () => {
  assert.deepEqual(summarizeSupplierLedger([]), {
    billCount: 0,
    billsTotal: 0,
    paymentCount: 0,
    paymentsTotal: 0,
    netChange: 0,
    breakdown: [],
  })
})
