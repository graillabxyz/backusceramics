import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PUBLIC_WARES_CATEGORIES, parseProductImageUrls } from "@/lib/pos-catalog"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_SHOP_CART_BODY_BYTES = 32 * 1024
const PUBLIC_CATEGORY_IDS = PUBLIC_WARES_CATEGORIES.map((category) => category.id)

interface RawCartItem {
  productId?: unknown
  quantity?: unknown
}

function normalizeRequestedItems(items: unknown) {
  if (!Array.isArray(items)) return []

  const quantities = new Map<string, number>()
  items.slice(0, 25).forEach((item: RawCartItem) => {
    const productId = String(item?.productId || "").trim()
    const quantity = Math.max(Math.round(Number(item?.quantity || 0)), 0)
    if (!productId || quantity < 1) return
    quantities.set(productId, Math.min((quantities.get(productId) || 0) + quantity, 99))
  })

  return Array.from(quantities.entries()).map(([productId, quantity]) => ({ productId, quantity }))
}

export async function POST(req: NextRequest) {
  if (isRequestBodyTooLarge(req, MAX_SHOP_CART_BODY_BYTES)) {
    return NextResponse.json({ error: "Cart payload is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  const requestedItems = normalizeRequestedItems(data?.items)
  const requestedById = new Map(requestedItems.map((item) => [item.productId, item.quantity]))

  if (requestedItems.length === 0) {
    return NextResponse.json({ items: [], unavailableProductIds: [] })
  }

  const products = await prisma.posProduct.findMany({
    where: {
      id: { in: requestedItems.map((item) => item.productId) },
      category: { in: PUBLIC_CATEGORY_IDS },
      status: "AVAILABLE",
      showInShop: true,
      cafeOnly: false,
      price: { gt: 0 },
      quantity: { gt: 0 },
    },
    orderBy: [
      { featured: "desc" },
      { createdAt: "desc" },
    ],
  })
  const availableIds = new Set(products.map((product) => product.id))

  return NextResponse.json({
    items: products.map((product) => {
      const requestedQuantity = requestedById.get(product.id) || 1
      const quantity = Math.min(requestedQuantity, product.quantity)

      return {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        currency: product.currency,
        availableQuantity: product.quantity,
        quantity,
        image: parseProductImageUrls(product.imageUrls)[0] || "",
        volumeMl: product.volumeMl,
        weightGrams: product.weightGrams,
        lengthCm: product.lengthCm,
        widthCm: product.widthCm,
        heightCm: product.heightCm,
      }
    }),
    unavailableProductIds: requestedItems
      .map((item) => item.productId)
      .filter((productId) => !availableIds.has(productId)),
  })
}
