const ONLINE_SHOP_NOTE = "[online-shop]"

export interface PosSaleAttributionInput {
  id: string
  operatorId?: string | null
  operator?: { name?: string | null; email?: string | null } | null
  paymentMethod?: string | null
  paymentReference?: string | null
  paymentSessionId?: string | null
  notes?: string | null
}

function isAutonomousOnlineSale(sale: PosSaleAttributionInput) {
  if (sale.notes?.trimStart().startsWith(ONLINE_SHOP_NOTE)) return true

  return !sale.operatorId
    && sale.paymentMethod === "ONLINE"
    && Boolean(sale.paymentSessionId || sale.paymentReference)
}

export function getPosSaleAttribution(sale: PosSaleAttributionInput) {
  if (isAutonomousOnlineSale(sale)) {
    return { key: "online-sale", label: "Online sale" }
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
