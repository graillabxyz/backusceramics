import { getSalesChannel, salesChannelLabels } from "@/lib/sales-ledger"

export interface PosSaleAttributionInput {
  id: string
  operatorId?: string | null
  operator?: { name?: string | null; email?: string | null } | null
  paymentMethod?: string | null
  paymentReference?: string | null
  paymentSessionId?: string | null
  paymentLinkId?: string | null
  notes?: string | null
}

export function getPosSaleAttribution(sale: PosSaleAttributionInput) {
  const channel = getSalesChannel(sale)
  if (channel !== "POS") {
    return { key: `channel:${channel}`, label: salesChannelLabels[channel] }
  }

  const operatorName = sale.operator?.name?.trim() || sale.operator?.email?.trim()
  if (operatorName) {
    return { key: sale.operatorId || `operator:${operatorName}`, label: operatorName }
  }

  const reference = sale.paymentReference?.trim() || sale.id.slice(-8).toUpperCase()
  return {
    key: `unassigned:${sale.id}`,
    label: `Unassigned sale · ${reference}`,
  }
}
