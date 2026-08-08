export interface PosCashExpense {
  description: string
  amount: number
}

export interface PosCashReconciliation {
  openingCash: number
  cashSales: number
  cashExpenses: number
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
}: {
  openingCash: number
  cashSales: number
  closingCash: number
  cashExpenseItems: PosCashExpense[]
}): PosCashReconciliation {
  const cashExpenses = cashExpenseItems.reduce((total, expense) => total + expense.amount, 0)
  const expectedClosingCash = openingCash + cashSales - cashExpenses

  return {
    openingCash,
    cashSales,
    cashExpenses,
    cashExpenseItems,
    expectedClosingCash,
    closingCash,
    cashVariance: closingCash - expectedClosingCash,
  }
}
