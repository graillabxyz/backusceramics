import assert from "node:assert/strict"
import test from "node:test"
import { summarizeCashOuts } from "../lib/pos-cash-outs"

test("cash out summary separates drawer cash from staff-funded purchases", () => {
  const summary = summarizeCashOuts([
    { fundingSource: "REGISTER", amount: 100_000, businessDate: "2026-08-12" },
    { fundingSource: "STAFF", amount: 250_000, businessDate: "2026-08-12" },
    { fundingSource: "STAFF", amount: 75_000, businessDate: "2026-08-11", reimbursedAt: new Date(), reimbursedBusinessDate: "2026-08-12", reimbursementMethod: "REGISTER_CASH" },
  ], "2026-08-12")

  assert.equal(summary.registerPurchaseTotal, 100_000)
  assert.equal(summary.registerReimbursementTotal, 75_000)
  assert.equal(summary.registerCashOutTotal, 175_000)
  assert.equal(summary.staffFundedTotal, 250_000)
  assert.equal(summary.staffReimbursedTotal, 75_000)
  assert.equal(summary.outstandingStaffDebt, 250_000)
})

test("voided entries do not affect cash or staff debt", () => {
  const summary = summarizeCashOuts([
    { fundingSource: "REGISTER", amount: 100_000, businessDate: "2026-08-12", voidedAt: new Date() },
    { fundingSource: "STAFF", amount: 250_000, businessDate: "2026-08-12", voidedAt: new Date() },
  ], "2026-08-12")

  assert.equal(summary.registerCashOutTotal, 0)
  assert.equal(summary.staffFundedTotal, 0)
  assert.equal(summary.outstandingStaffDebt, 0)
})
