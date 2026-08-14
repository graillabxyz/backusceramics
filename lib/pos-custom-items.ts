export const POS_CUSTOM_ITEM_TYPES = ["DISCOUNT_BOX", "CLIENT_ORDER"] as const

export type PosCustomItemType = (typeof POS_CUSTOM_ITEM_TYPES)[number]

const CUSTOM_ITEM_METADATA: Record<PosCustomItemType, {
  defaultName: string
  sku: string
  category: string
}> = {
  DISCOUNT_BOX: {
    defaultName: "Discount box ceramic",
    sku: "DISCOUNT-BOX",
    category: "OTHER",
  },
  CLIENT_ORDER: {
    defaultName: "",
    sku: "CLIENT-ORDER",
    category: "CLIENT_ORDERS",
  },
}

export function normalizePosCustomItemType(value: unknown): PosCustomItemType | null {
  return POS_CUSTOM_ITEM_TYPES.includes(value as PosCustomItemType)
    ? value as PosCustomItemType
    : null
}

export function getPosCustomItemMetadata(type: PosCustomItemType) {
  return CUSTOM_ITEM_METADATA[type]
}
