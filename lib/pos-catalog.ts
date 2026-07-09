export const POS_PRODUCT_CATEGORIES = [
  { id: "F_AND_B", label: "Cafe", publicListing: false },
  { id: "CLASSES", label: "Classes", publicListing: false },
  { id: "CUPS", label: "Cups", publicListing: true },
  { id: "VASES", label: "Vases", publicListing: true },
  { id: "LAMPS", label: "Lamps", publicListing: true },
  { id: "TABLEWARE", label: "Tableware", publicListing: true },
  { id: "OTHER", label: "Other", publicListing: true },
] as const

export type PosProductCategory = (typeof POS_PRODUCT_CATEGORIES)[number]["id"]

const categoryAliases: Record<string, PosProductCategory> = {
  "BOWLS": "TABLEWARE",
  "COFFEE GEAR": "CUPS",
  "SETS": "TABLEWARE",
  "STUDIO PIECES": "OTHER",
  "PLATTERS": "TABLEWARE",
  "TEA WARE": "CUPS",
  "FOOD AND BEVERAGE": "F_AND_B",
  "F AND B": "F_AND_B",
  "F&B": "F_AND_B",
  "CAFE": "F_AND_B",
  "CLASS": "CLASSES",
  "WORKSHOP": "CLASSES",
  "WORKSHOPS": "CLASSES",
  "RESIDENCY": "CLASSES",
  "RESIDENCIES": "CLASSES",
}

export const POS_PRODUCT_STATUSES = ["AVAILABLE", "DRAFT", "SOLD", "ARCHIVED"] as const
export type PosProductStatus = (typeof POS_PRODUCT_STATUSES)[number]

export const POS_PAYMENT_METHODS = ["CARD_MACHINE", "CASH", "QRIS", "TRANSFER", "ONLINE", "OTHER"] as const
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number]

export const POS_SALE_STATUSES = ["PAID", "PENDING_PAYMENT", "CANCELLED", "VOIDED"] as const
export type PosSaleStatus = (typeof POS_SALE_STATUSES)[number]

export const PUBLIC_WARES_CATEGORIES = POS_PRODUCT_CATEGORIES.filter((category) => category.publicListing)

export function normalizeProductCategory(value: unknown): PosProductCategory {
  const rawValue = String(value || "").trim().toUpperCase()
  const normalized = String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .toUpperCase()

  const direct = POS_PRODUCT_CATEGORIES.find((category) => {
    const normalizedId = category.id.replace(/[-_]+/g, " ").toUpperCase()
    return category.id === rawValue || normalizedId === normalized || category.label.toUpperCase() === normalized
  })
  if (direct) return direct.id

  return categoryAliases[normalized] || "OTHER"
}

export function getProductCategoryLabel(value: unknown) {
  const category = normalizeProductCategory(value)
  return POS_PRODUCT_CATEGORIES.find((item) => item.id === category)?.label || "Other"
}

export function isCupCategory(value: unknown) {
  return normalizeProductCategory(value) === "CUPS"
}

export function parseProductImageUrls(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 8)
  }

  if (typeof value !== "string") return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parseProductImageUrls(parsed)
  } catch {
    // Fall back to newline/comma parsing for admin-entered URLs.
  }

  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

export function serializeProductImageUrls(value: unknown) {
  const imageUrls = parseProductImageUrls(value)
  return imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price)
}
