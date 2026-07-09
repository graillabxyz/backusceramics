import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessAdmin } from "@/lib/permissions"
import { WallOfCupsAdminPreview, type WallOfCupsProduct } from "./wall-of-cups-admin-preview"

export const dynamic = "force-dynamic"

export default async function AdminWallOfCupsPage() {
  const session = await auth()
  if (!session || !canAccessAdmin(session.user.role)) {
    notFound()
  }

  const products = await prisma.posProduct.findMany({
    where: {
      category: "CUPS",
      cafeOnly: false,
      status: { not: "ARCHIVED" },
    },
    orderBy: [
      { showInShop: "desc" },
      { featured: "desc" },
      { createdAt: "desc" },
    ],
  })

  const previewProducts: WallOfCupsProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    volumeMl: product.volumeMl,
    imageUrls: product.imageUrls,
    price: product.price,
    category: product.category,
    quantity: product.quantity,
    status: product.status,
    showInShop: product.showInShop,
    featured: product.featured,
  }))

  return <WallOfCupsAdminPreview initialProducts={previewProducts} />
}
