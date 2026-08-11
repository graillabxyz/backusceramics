export interface PosCashExpense {
  description: string
  amount: number
}

export interface PosCashReconciliation {
  openingCash: number
  cashSales: number
  cashExpenses: number
  supplierCashPayments: number
  cashExpenseItems: PosCashExpense[]
  expectedClosingCash: number
  closingCash: number
  cashVariance: number
}

export function calculatePosCashReconciliation({
  openingCash,
  cashSales,
  closingCash,
  cashExpenseItems,
  supplierCashPayments = 0,
}: {
  openingCash: number
  cashSales: number
  closingCash: number
  cashExpenseItems: PosCashExpense[]
  supplierCashPayments?: number
}): PosCashReconciliation {
  const cashExpenses = cashExpenseItems.reduce((total, expense) => total + expense.amount, 0)
  const expectedClosingCash = openingCash + cashSales - cashExpenses - supplierCashPayments

  return {
    openingCash,
    cashSales,
    cashExpenses,
    cashExpenseItems,
    supplierCashPayments,
    expectedClosingCash,
    closingCash,
    cashVariance: closingCash - expectedClosingCash,
  }
}
