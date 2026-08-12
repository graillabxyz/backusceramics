export const CASH_OUT_FUNDING_SOURCES = ["REGISTER", "STAFF"] as const
export const CASH_OUT_REIMBURSEMENT_METHODS = ["REGISTER_CASH", "TRANSFER", "OTHER"] as const

export type CashOutFundingSource = (typeof CASH_OUT_FUNDING_SOURCES)[number]
export type CashOutReimbursementMethod = (typeof CASH_OUT_REIMBURSEMENT_METHODS)[number]

export function summarizeCashOuts(entries: Array<{
  fundingSource: string
  amount: number
  businessDate: string
  reimbursedAt?: Date | string | null
  reimbursedBusinessDate?: string | null
  reimbursementMethod?: string | null
  voidedAt?: Date | string | null
}>, startDate: string, endDate = startDate) {
  const active = entries.filter((entry) => !entry.voidedAt)
  const createdInRange = active.filter((entry) => entry.businessDate >= startDate && entry.businessDate <= endDate)
  const reimbursedInRange = active.filter((entry) => entry.reimbursedAt && entry.reimbursedBusinessDate && entry.reimbursedBusinessDate >= startDate && entry.reimbursedBusinessDate <= endDate)
  const registerPurchases = createdInRange.filter((entry) => entry.fundingSource === "REGISTER")
  const registerReimbursements = reimbursedInRange.filter((entry) => entry.reimbursementMethod === "REGISTER_CASH")

  return {
    registerPurchaseTotal: registerPurchases.reduce((total, entry) => total + entry.amount, 0),
    registerReimbursementTotal: registerReimbursements.reduce((total, entry) => total + entry.amount, 0),
    registerCashOutTotal: [...registerPurchases, ...registerReimbursements].reduce((total, entry) => total + entry.amount, 0),
    staffFundedTotal: createdInRange.filter((entry) => entry.fundingSource === "STAFF").reduce((total, entry) => total + entry.amount, 0),
    staffReimbursedTotal: reimbursedInRange.reduce((total, entry) => total + entry.amount, 0),
    outstandingStaffDebt: active.filter((entry) => entry.fundingSource === "STAFF" && !entry.reimbursedAt).reduce((total, entry) => total + entry.amount, 0),
  }
}
