import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import {
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

export async function GET() {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.posProduct.findMany({
    orderBy: [
      { sortOrder: "asc" },
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
  const price = Number(data.price)
  const quantity = Number(data.quantity || 1)
  const status = data.status || "AVAILABLE"
  const cafeOnly = Boolean(data.cafeOnly)
  const showInShop = cafeOnly ? false : Boolean(data.showInShop)
  const sortOrder = Number(data.sortOrder || 0)

  if (!name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 })
  }

  if (!Number.isInteger(price) || price < 0) {
    return NextResponse.json({ error: "Price must be a whole number in IDR" }, { status: 400 })
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ error: "Quantity must be zero or higher" }, { status: 400 })
  }

  if (!POS_PRODUCT_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid product status" }, { status: 400 })
  }

  if (!Number.isInteger(sortOrder)) {
    return NextResponse.json({ error: "Sort order must be a whole number" }, { status: 400 })
  }

  const product = await prisma.posProduct.create({
    data: {
      createdBy: session.user.id,
      name,
      slug: await uniqueSlug(name),
      sku: data.sku ? String(data.sku).trim() : null,
      description: data.description ? String(data.description).trim() : null,
      imageUrls: serializeProductImageUrls(data.imageUrls),
      price,
      category,
      quantity,
      status,
      cafeOnly,
      showInShop,
      featured: Boolean(data.featured),
      sortOrder,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
