import assert from "node:assert/strict"
import test from "node:test"
import { buildSupplierAccountBalances, normalizeSupplierName, summarizeSupplierLedger, supplierAccountLabel } from "../lib/supplier-ledger"

test("normalizes supplier names for duplicate prevention", () => {
  assert.equal(normalizeSupplierName("  Bali   Fresh FOOD  "), "bali fresh food")
})

test("supplier accounts distinguish outlets without obscuring the supplier", () => {
  assert.equal(supplierAccountLabel("Bali Fresh Food", "Sanur"), "Bali Fresh Food · Sanur")
  assert.equal(supplierAccountLabel("Bali Fresh Food", "  "), "Bali Fresh Food")
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

test("cumulative debt remains separate for each outlet", () => {
  const summary = summarizeSupplierLedger([
    { supplierId: "fresh-sanur", supplierName: "Fresh Foods · Sanur", entryType: "BILL", amount: 900_000 },
    { supplierId: "fresh-sanur", supplierName: "Fresh Foods · Sanur", entryType: "PAYMENT", amount: 300_000 },
    { supplierId: "fresh-ubud", supplierName: "Fresh Foods · Ubud", entryType: "BILL", amount: 250_000 },
  ])

  assert.deepEqual(summary.breakdown.map((item) => [item.supplierName, item.billsTotal, item.paymentsTotal, item.netChange]), [
    ["Fresh Foods · Sanur", 900_000, 300_000, 600_000],
    ["Fresh Foods · Ubud", 250_000, 0, 250_000],
  ])
})

test("supplier debt and credit remain explicit instead of cancelling each other", () => {
  const summary = summarizeSupplierLedger([
    { supplierId: "produce", supplierName: "Produce", entryType: "BILL", amount: 500_000 },
    { supplierId: "produce", supplierName: "Produce", entryType: "PAYMENT", amount: 200_000 },
    { supplierId: "milk", supplierName: "Milk", entryType: "BILL", amount: 100_000 },
    { supplierId: "milk", supplierName: "Milk", entryType: "PAYMENT", amount: 150_000 },
  ])
  const balances = buildSupplierAccountBalances(summary)

  assert.deepEqual(balances.map((item) => [item.supplierName, item.outstandingDebt, item.supplierCredit]), [
    ["Produce", 300_000, 0],
    ["Milk", 0, 50_000],
  ])
  assert.equal(balances.reduce((total, item) => total + item.outstandingDebt, 0), 300_000)
  assert.equal(balances.reduce((total, item) => total + item.supplierCredit, 0), 50_000)
})
