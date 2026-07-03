import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { getDefaultPosProducts } from "@/lib/pos-default-products"

export async function POST() {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const defaults = getDefaultPosProducts()
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    classItems: 0,
    fnbItems: 0,
  }

  for (const item of defaults) {
    const existing = await prisma.posProduct.findUnique({ where: { slug: item.slug } })

    if (!existing) {
      await prisma.posProduct.create({
        data: {
          createdBy: session.user.id,
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          description: item.description,
          price: item.price,
          category: item.category,
          quantity: item.quantity,
          status: item.status,
          cafeOnly: item.cafeOnly,
          showInShop: item.showInShop,
          featured: false,
        },
      })
      result.created += 1
      if (item.kind === "class") result.classItems += 1
      if (item.kind === "fnb") result.fnbItems += 1
      continue
    }

    if (item.kind === "class") {
      await prisma.posProduct.update({
        where: { slug: item.slug },
        data: {
          name: item.name,
          sku: item.sku,
          description: item.description,
          price: item.price,
          category: item.category,
          cafeOnly: item.cafeOnly,
          showInShop: item.showInShop,
          quantity: existing.quantity < item.quantity ? item.quantity : existing.quantity,
          status: existing.status === "ARCHIVED" ? existing.status : item.status,
        },
      })
      result.updated += 1
      result.classItems += 1
      continue
    }

    result.skipped += 1
    result.fnbItems += 1
  }

  return NextResponse.json({
    ok: true,
    ...result,
    total: defaults.length,
    note: "Cafe items are created as drafts because screenshot prices were not provided.",
  })
}
