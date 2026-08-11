import assert from "node:assert/strict"
import test from "node:test"
import { calculatePosCashReconciliation } from "../lib/pos-cash-reconciliation"

test("cash reconciliation subtracts expenses from opening cash and cash sales", () => {
  const result = calculatePosCashReconciliation({
    openingCash: 500_000,
    cashSales: 1_250_000,
    closingCash: 1_600_000,
    cashExpenseItems: [
      { description: "Market supplies", amount: 100_000 },
      { description: "Courier", amount: 50_000 },
    ],
  })

  assert.equal(result.cashExpenses, 150_000)
  assert.equal(result.expectedClosingCash, 1_600_000)
  assert.equal(result.cashVariance, 0)
})

test("cash reconciliation reports register shortages and overages", () => {
  const short = calculatePosCashReconciliation({
    openingCash: 300_000,
    cashSales: 700_000,
    closingCash: 975_000,
    cashExpenseItems: [],
  })
  const over = calculatePosCashReconciliation({
    openingCash: 300_000,
    cashSales: 700_000,
    closingCash: 1_025_000,
    cashExpenseItems: [],
  })

  assert.equal(short.cashVariance, -25_000)
  assert.equal(over.cashVariance, 25_000)
})

test("cash supplier payments reduce expected register cash without becoming generic expenses", () => {
  const result = calculatePosCashReconciliation({
    openingCash: 500_000,
    cashSales: 800_000,
    closingCash: 1_000_000,
    cashExpenseItems: [],
    supplierCashPayments: 300_000,
  })

  assert.equal(result.cashExpenses, 0)
  assert.equal(result.supplierCashPayments, 300_000)
  assert.equal(result.expectedClosingCash, 1_000_000)
  assert.equal(result.cashVariance, 0)
})
