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
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

interface ProductRouteContext {
  params: Promise<{ id: string }>
}

const MAX_PRODUCT_UPDATE_BODY_BYTES = 64 * 1024

function parseVolumeMl(value: unknown, category: string) {
  if (!isCupCategory(category)) return { value: null }
  if (value === null || value === undefined || value === "") return { value: null }

  const volumeMl = Number(value)
  if (!Number.isInteger(volumeMl) || volumeMl <= 0) {
    return { error: "Cup volume must be a whole number in ml" }
  }

  return { value: volumeMl }
}

export async function PATCH(req: NextRequest, { params }: ProductRouteContext) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_PRODUCT_UPDATE_BODY_BYTES)) {
    return NextResponse.json({ error: "Product payload is too large" }, { status: 413 })
  }

  const { id } = await params
  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Product request is not valid JSON" }, { status: 400 })
  const updateData: Record<string, unknown> = {}
  const nextCategory = "category" in data ? normalizeProductCategory(data.category) : undefined
  const currentProduct = await prisma.posProduct.findUnique({
    where: { id },
    select: {
      category: true,
      cafeOnly: true,
      price: true,
      quantity: true,
      status: true,
    },
  })

  if (!currentProduct) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  if ("name" in data) {
    const name = cleanString(data.name, 160)
    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 })
    updateData.name = name
  }

  if ("sku" in data) {
    const sku = cleanString(data.sku, 120)
    updateData.sku = sku || null
  }

  if ("description" in data) {
    const description = cleanString(data.description, 4000)
    updateData.description = description || null
  }

  if ("imageUrls" in data) {
    updateData.imageUrls = serializeProductImageUrls(data.imageUrls)
  }

  if ("category" in data) {
    updateData.category = nextCategory
    if (nextCategory === "F_AND_B") updateData.cafeOnly = true
    if (nextCategory && currentProduct.category === "F_AND_B" && nextCategory !== "F_AND_B" && !("cafeOnly" in data)) {
      updateData.cafeOnly = false
    }
    if (nextCategory && !isCupCategory(nextCategory)) updateData.showInShop = false
  }

  if ("volumeMl" in data || (nextCategory && !isCupCategory(nextCategory))) {
    const volumeMl = parseVolumeMl(data.volumeMl, nextCategory || currentProduct.category)
    if (volumeMl.error) {
      return NextResponse.json({ error: volumeMl.error }, { status: 400 })
    }
    updateData.volumeMl = volumeMl.value
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
    if (status === "DRAFT") {
      updateData.showInShop = false
      updateData.featured = false
    }
  }

  if ("cafeOnly" in data) {
    const category = nextCategory || currentProduct.category
    const cafeOnly = category === "F_AND_B" || Boolean(data.cafeOnly)
    updateData.cafeOnly = cafeOnly
    if (cafeOnly) updateData.showInShop = false
  }

  if ("showInShop" in data) {
    const cafeOnly = "cafeOnly" in data ? Boolean(data.cafeOnly) : currentProduct.cafeOnly
    const category = nextCategory || currentProduct.category
    updateData.showInShop = !cafeOnly && isCupCategory(category) ? Boolean(data.showInShop) : false
  }

  if ("featured" in data) {
    updateData.featured = Boolean(data.featured)
  }

  const nextStatus = String(updateData.status || currentProduct.status)
  const nextPrice = typeof updateData.price === "number" ? updateData.price : currentProduct.price
  const nextQuantity = typeof updateData.quantity === "number" ? updateData.quantity : currentProduct.quantity

  if (nextStatus === "DRAFT") {
    updateData.showInShop = false
    updateData.featured = false
  }

  if (nextStatus === "AVAILABLE") {
    if (!Number.isInteger(nextPrice) || nextPrice <= 0) {
      return NextResponse.json({ error: "Price is required before a product can be available" }, { status: 400 })
    }

    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1 before a product can be available" }, { status: 400 })
    }
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
