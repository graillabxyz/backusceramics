export interface PosCashExpense {
  description: string
  amount: number
}

export interface PosCashReconciliation {
  openingCash: number
  cashSales: number
  cashExpenses: number
  registerCashOuts: number
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
  registerCashOuts = 0,
}: {
  openingCash: number
  cashSales: number
  closingCash: number
  cashExpenseItems: PosCashExpense[]
  supplierCashPayments?: number
  registerCashOuts?: number
}): PosCashReconciliation {
  const cashExpenses = cashExpenseItems.reduce((total, expense) => total + expense.amount, 0)
  const expectedClosingCash = openingCash + cashSales - cashExpenses - supplierCashPayments - registerCashOuts

  return {
    openingCash,
    cashSales,
    cashExpenses,
    registerCashOuts,
    cashExpenseItems,
    supplierCashPayments,
    expectedClosingCash,
    closingCash,
    cashVariance: closingCash - expectedClosingCash,
  }
}
