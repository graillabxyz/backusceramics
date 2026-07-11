import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PUBLIC_WARES_CATEGORIES } from "@/lib/pos-catalog"
import { calculateCeramicShipping } from "@/lib/shop-shipping"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

const MAX_QUOTE_BODY_BYTES = 32 * 1024
const PUBLIC_CATEGORY_IDS = PUBLIC_WARES_CATEGORIES.map((category) => category.id)

interface RawQuoteItem {
  productId?: unknown
  quantity?: unknown
}

function normalizeItems(items: unknown) {
  if (!Array.isArray(items)) return []
  const quantities = new Map<string, number>()

  items.slice(0, 25).forEach((item: RawQuoteItem) => {
    const productId = String(item?.productId || "").trim()
    const quantity = Math.min(Math.max(Math.round(Number(item?.quantity || 0)), 0), 99)
    if (!productId || quantity < 1) return
    quantities.set(productId, Math.min((quantities.get(productId) || 0) + quantity, 99))
  })

  return Array.from(quantities.entries()).map(([productId, quantity]) => ({ productId, quantity }))
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "shop-shipping-quote", limit: 30, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many shipping requests. Please wait a moment and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_QUOTE_BODY_BYTES)) {
    return NextResponse.json({ error: "Shipping request is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  const items = normalizeItems(data?.items)
  const countryCode = String(data?.countryCode || "").trim().toUpperCase()
  if (items.length === 0) return NextResponse.json({ error: "Add an available piece before calculating shipping." }, { status: 400 })

  const products = await prisma.posProduct.findMany({
    where: {
      id: { in: items.map((item) => item.productId) },
      category: { in: PUBLIC_CATEGORY_IDS },
      status: "AVAILABLE",
      showInShop: true,
      cafeOnly: false,
      price: { gt: 0 },
      quantity: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      category: true,
      quantity: true,
      weightGrams: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
    },
  })

  if (products.length !== items.length) {
    return NextResponse.json({ error: "One or more pieces are no longer available." }, { status: 409 })
  }

  const requested = new Map(items.map((item) => [item.productId, item.quantity]))
  if (products.some((product) => product.quantity < (requested.get(product.id) || 1))) {
    return NextResponse.json({ error: "One or more pieces no longer have enough stock." }, { status: 409 })
  }

  try {
    const quote = calculateCeramicShipping(
      products.map((product) => ({ ...product, quantity: requested.get(product.id) || 1 })),
      countryCode
    )
    return NextResponse.json({ quote })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Shipping could not be calculated." },
      { status: 400 }
    )
  }
}
