import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import {
  normalizeProductCategory,
  POS_PRODUCT_STATUSES,
  serializeProductImageUrls,
} from "@/lib/pos-catalog"

interface ProductRouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: ProductRouteContext) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const data = await req.json()
  const updateData: Record<string, unknown> = {}

  if ("name" in data) {
    const name = String(data.name || "").trim()
    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 })
    updateData.name = name
  }

  if ("sku" in data) {
    const sku = String(data.sku || "").trim()
    updateData.sku = sku || null
  }

  if ("description" in data) {
    const description = String(data.description || "").trim()
    updateData.description = description || null
  }

  if ("imageUrls" in data) {
    updateData.imageUrls = serializeProductImageUrls(data.imageUrls)
  }

  if ("category" in data) {
    updateData.category = normalizeProductCategory(data.category)
  }

  if ("price" in data) {
    const price = Number(data.price)
    if (!Number.isInteger(price) || price < 0) {
      return NextResponse.json({ error: "Price must be a whole number in IDR" }, { status: 400 })
    }
    updateData.price = price
  }

  if ("quantity" in data) {
    const quantity = Number(data.quantity)
    if (!Number.isInteger(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Quantity must be zero or higher" }, { status: 400 })
    }
    updateData.quantity = quantity
    if (quantity === 0 && !("status" in data)) updateData.status = "SOLD"
  }

  if ("status" in data) {
    const status = data.status
    if (!POS_PRODUCT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid product status" }, { status: 400 })
    }
    updateData.status = status
  }

  if ("cafeOnly" in data) {
    updateData.cafeOnly = Boolean(data.cafeOnly)
    if (Boolean(data.cafeOnly)) updateData.showInShop = false
  }

  if ("showInShop" in data) {
    const cafeOnly = "cafeOnly" in data ? Boolean(data.cafeOnly) : undefined
    if (!cafeOnly) updateData.showInShop = Boolean(data.showInShop)
  }

  if ("featured" in data) {
    updateData.featured = Boolean(data.featured)
  }

  if ("sortOrder" in data) {
    const sortOrder = Number(data.sortOrder || 0)
    if (!Number.isInteger(sortOrder)) {
      return NextResponse.json({ error: "Sort order must be a whole number" }, { status: 400 })
    }
    updateData.sortOrder = sortOrder
  }

  try {
    const product = await prisma.posProduct.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Could not update POS product", { error, id })
    return NextResponse.json({ error: "Product could not be updated" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: ProductRouteContext) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const product = await prisma.posProduct.update({
      where: { id },
      data: { status: "ARCHIVED", showInShop: false, featured: false },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Could not archive POS product", { error, id })
    return NextResponse.json({ error: "Product could not be archived" }, { status: 500 })
  }
}
