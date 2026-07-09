export const SHOP_CART_STORAGE_KEY = "backus:shop-cart:v1"

export interface ShopCartItem {
  productId: string
  quantity: number
}

function normalizeCartItems(value: unknown): ShopCartItem[] {
  if (!Array.isArray(value)) return []

  const quantities = new Map<string, number>()
  value.forEach((item) => {
    const productId = String(item?.productId || "").trim()
    const quantity = Math.max(Math.round(Number(item?.quantity || 0)), 0)
    if (!productId || quantity < 1) return
    quantities.set(productId, Math.min((quantities.get(productId) || 0) + quantity, 99))
  })

  return Array.from(quantities.entries()).map(([productId, quantity]) => ({ productId, quantity }))
}

export function readShopCart(): ShopCartItem[] {
  if (typeof window === "undefined") return []

  try {
    const rawValue = window.localStorage.getItem(SHOP_CART_STORAGE_KEY)
    return normalizeCartItems(rawValue ? JSON.parse(rawValue) : [])
  } catch {
    return []
  }
}

export function writeShopCart(items: ShopCartItem[]) {
  if (typeof window === "undefined") return

  try {
    const normalized = normalizeCartItems(items)
    if (normalized.length === 0) {
      window.localStorage.removeItem(SHOP_CART_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(SHOP_CART_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Cart storage is a convenience; checkout still validates on the server.
  }
}

export function clearShopCart() {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(SHOP_CART_STORAGE_KEY)
  } catch {
    // Ignore blocked storage.
  }
}

export function upsertShopCartItem(productId: string, quantity = 1, maxQuantity = 99) {
  const normalizedProductId = productId.trim()
  if (!normalizedProductId) return []

  const cart = readShopCart()
  const existing = cart.find((item) => item.productId === normalizedProductId)
  const nextQuantity = Math.min(Math.max((existing?.quantity || 0) + quantity, 1), Math.max(maxQuantity, 1))
  const nextCart = existing
    ? cart.map((item) => item.productId === normalizedProductId ? { ...item, quantity: nextQuantity } : item)
    : [...cart, { productId: normalizedProductId, quantity: Math.min(Math.max(quantity, 1), Math.max(maxQuantity, 1)) }]

  writeShopCart(nextCart)
  return nextCart
}
