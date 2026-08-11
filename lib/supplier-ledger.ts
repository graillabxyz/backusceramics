import { prisma } from "@/lib/prisma"

export const SUPPLIER_ENTRY_TYPES = ["BILL", "PAYMENT"] as const
export type SupplierEntryType = (typeof SUPPLIER_ENTRY_TYPES)[number]

export interface SupplierLedgerValue {
  supplierId: string
  supplierName: string
  entryType: SupplierEntryType
  amount: number
}

export interface SupplierBreakdown {
  supplierId: string
  supplierName: string
  billCount: number
  billsTotal: number
  paymentCount: number
  paymentsTotal: number
  netChange: number
}

export interface SupplierLedgerSummary {
  billCount: number
  billsTotal: number
  paymentCount: number
  paymentsTotal: number
  netChange: number
  breakdown: SupplierBreakdown[]
}

export function normalizeSupplierName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
}

export function summarizeSupplierLedger(entries: SupplierLedgerValue[]): SupplierLedgerSummary {
  const suppliers = new Map<string, SupplierBreakdown>()
  let billCount = 0
  let billsTotal = 0
  let paymentCount = 0
  let paymentsTotal = 0

  for (const entry of entries) {
    const current = suppliers.get(entry.supplierId) || {
      supplierId: entry.supplierId,
      supplierName: entry.supplierName,
      billCount: 0,
      billsTotal: 0,
      paymentCount: 0,
      paymentsTotal: 0,
      netChange: 0,
    }

    if (entry.entryType === "BILL") {
      billCount += 1
      billsTotal += entry.amount
      current.billCount += 1
      current.billsTotal += entry.amount
    } else {
      paymentCount += 1
      paymentsTotal += entry.amount
      current.paymentCount += 1
      current.paymentsTotal += entry.amount
    }
    current.netChange = current.billsTotal - current.paymentsTotal
    suppliers.set(entry.supplierId, current)
  }

  return {
    billCount,
    billsTotal,
    paymentCount,
    paymentsTotal,
    netChange: billsTotal - paymentsTotal,
    breakdown: Array.from(suppliers.values()).sort((a, b) => b.netChange - a.netChange || a.supplierName.localeCompare(b.supplierName)),
  }
}

export async function buildSupplierLedgerReport(startDate: string, endDate: string) {
  const [periodEntries, outstandingEntries] = await Promise.all([
    prisma.supplierLedgerEntry.findMany({
      where: { businessDate: { gte: startDate, lte: endDate }, voidedAt: null },
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.supplierLedgerEntry.findMany({
      where: { businessDate: { lte: endDate }, voidedAt: null },
      select: { supplierId: true, entryType: true, amount: true, supplier: { select: { name: true } } },
    }),
  ])

  const period = summarizeSupplierLedger(periodEntries.map((entry) => ({
    supplierId: entry.supplierId,
    supplierName: entry.supplier.name,
    entryType: entry.entryType as SupplierEntryType,
    amount: entry.amount,
  })))
  const outstanding = summarizeSupplierLedger(outstandingEntries.map((entry) => ({
    supplierId: entry.supplierId,
    supplierName: entry.supplier.name,
    entryType: entry.entryType as SupplierEntryType,
    amount: entry.amount,
  })))

  return { ...period, outstanding: outstanding.netChange, entries: periodEntries }
}
