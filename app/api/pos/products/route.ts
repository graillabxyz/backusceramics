import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import {
  isCupCategory,
  normalizeProductCategory,
  POS_PRODUCT_STATUSES,
  serializeProductImageUrls,
} from "@/lib/pos-catalog"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function uniqueSlug(name: string) {
  const baseSlug = slugify(name) || `product-${Date.now()}`
  let slug = baseSlug
  let suffix = 2

  while (await prisma.posProduct.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}

function parseVolumeMl(value: unknown, category: string) {
  if (!isCupCategory(category)) return { value: null }
  if (value === null || value === undefined || value === "") return { value: null }

  const volumeMl = Number(value)
  if (!Number.isInteger(volumeMl) || volumeMl <= 0) {
    return { error: "Cup volume must be a whole number in ml" }
  }

  return { value: volumeMl }
}

export async function GET() {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.posProduct.findMany({
    orderBy: [
      { featured: "desc" },
      { createdAt: "desc" },
    ],
  })

  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await req.json()
  const name = String(data.name || "").trim()
  const category = normalizeProductCategory(data.category)
  const rawStatus = data.status || "DRAFT"
  if (!POS_PRODUCT_STATUSES.includes(rawStatus)) {
    return NextResponse.json({ error: "Invalid product status" }, { status: 400 })
  }
  const status = rawStatus
  const isDraft = status === "DRAFT"
  const price = data.price === "" || data.price === null || data.price === undefined ? null : Number(data.price)
  const quantity = data.quantity === "" || data.quantity === null || data.quantity === undefined ? null : Number(data.quantity)
  const cafeOnly = Boolean(data.cafeOnly)
  const showInShop = cafeOnly || isDraft ? false : Boolean(data.showInShop)
  const volumeMl = parseVolumeMl(data.volumeMl, category)

  if (!name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 })
  }

  if (price !== null && (!Number.isInteger(price) || price < 0)) {
    return NextResponse.json({ error: "Price must be a whole number in IDR" }, { status: 400 })
  }

  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
    return NextResponse.json({ error: "Quantity must be zero or higher" }, { status: 400 })
  }

  if (!isDraft && (price === null || !Number.isInteger(price) || price <= 0)) {
    return NextResponse.json({ error: "Price is required before a product can be available" }, { status: 400 })
  }

  if (!isDraft && (quantity === null || !Number.isInteger(quantity) || quantity < 1)) {
    return NextResponse.json({ error: "Quantity must be at least 1 before a product can be available" }, { status: 400 })
  }

  if (volumeMl.error) {
    return NextResponse.json({ error: volumeMl.error }, { status: 400 })
  }

  const product = await prisma.posProduct.create({
    data: {
      createdBy: session.user.id,
      name,
      slug: await uniqueSlug(name),
      sku: data.sku ? String(data.sku).trim() : null,
      description: data.description ? String(data.description).trim() : null,
      volumeMl: volumeMl.value,
      imageUrls: serializeProductImageUrls(data.imageUrls),
      price: price ?? 0,
      category,
      quantity: quantity ?? 0,
      status,
      cafeOnly,
      showInShop,
      featured: isDraft ? false : Boolean(data.featured),
    },
  })

  return NextResponse.json(product, { status: 201 })
}
