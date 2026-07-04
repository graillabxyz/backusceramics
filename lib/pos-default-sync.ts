import { prisma } from "@/lib/prisma"
import { getDefaultPosProducts } from "@/lib/pos-default-products"

interface SyncDefaultPosProductsOptions {
  createdBy?: string | null
}

export async function syncDefaultPosProducts(options: SyncDefaultPosProductsOptions = {}) {
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
          createdBy: options.createdBy || null,
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
      const nextStatus = existing.status === "ARCHIVED" ? existing.status : item.status
      const nextQuantity = existing.quantity < item.quantity ? item.quantity : existing.quantity
      const needsUpdate =
        existing.name !== item.name ||
        existing.sku !== item.sku ||
        existing.description !== item.description ||
        existing.price !== item.price ||
        existing.category !== item.category ||
        existing.cafeOnly !== item.cafeOnly ||
        existing.showInShop !== item.showInShop ||
        existing.quantity !== nextQuantity ||
        existing.status !== nextStatus

      if (!needsUpdate) {
        result.skipped += 1
        result.classItems += 1
        continue
      }

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
          quantity: nextQuantity,
          status: nextStatus,
        },
      })
      result.updated += 1
      result.classItems += 1
      continue
    }

    result.skipped += 1
    result.fnbItems += 1
  }

  return {
    ...result,
    total: defaults.length,
    note: "Cafe items are created as drafts because screenshot prices were not provided.",
  }
}
