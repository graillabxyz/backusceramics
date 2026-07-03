import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessAdmin } from "@/lib/permissions"
import {
  formatPrice,
  getProductCategoryLabel,
  isCupCategory,
  normalizeProductCategory,
  parseProductImageUrls,
  PUBLIC_WARES_CATEGORIES,
} from "@/lib/pos-catalog"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function AdminWaresPreviewPage() {
  const session = await auth()
  if (!session || !canAccessAdmin(session.user.role)) {
    notFound()
  }

  const products = await prisma.posProduct.findMany({
    where: {
      status: "AVAILABLE",
      showInShop: true,
      cafeOnly: false,
      quantity: { gt: 0 },
    },
    orderBy: [
      { featured: "desc" },
      { createdAt: "desc" },
    ],
  })

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-md border border-border bg-background">
        <div className="grid gap-8 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div className="max-w-3xl">
            <Badge variant="secondary">Admin-only preview</Badge>
            <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Ceramic Wares
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Cups are small works of art that still work for a living. They sit in the hand,
              gather heat, hold ceremony when asked, and quietly improve the ordinary parts of a day.
            </p>
            <div className="mt-8 border-l-2 border-primary pl-5 font-heading text-2xl leading-relaxed text-foreground">
              clay remembers touch<br />
              morning rests inside the cup<br />
              hands wake with the day
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-5">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Preview rules</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>Only products marked “Show on wares page” appear here.</li>
              <li>Cafe-only products stay in the POS and are hidden from this page.</li>
              <li>This page is under admin while the catalog is being tested.</li>
            </ul>
          </div>
        </div>
      </section>

      {PUBLIC_WARES_CATEGORIES.map((category) => {
        const categoryProducts = products.filter((product) => normalizeProductCategory(product.category) === category.id)
        if (categoryProducts.length === 0) return null

        return (
          <section key={category.id} className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-bold text-foreground">{category.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{categoryProducts.length} available</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categoryProducts.map((product) => {
                const image = parseProductImageUrls(product.imageUrls)[0]

                return (
                  <article key={product.id} className="overflow-hidden rounded-md border border-border bg-background">
                    <div className="aspect-[4/5] bg-muted">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                          Add a product image
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold leading-snug text-foreground">{product.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {product.sku || getProductCategoryLabel(product.category)}
                            {isCupCategory(product.category) && product.volumeMl && (
                              <span> · {product.volumeMl} ml</span>
                            )}
                          </p>
                        </div>
                        {product.featured && <Badge>Featured</Badge>}
                      </div>
                      {product.description && (
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="font-semibold text-foreground">{formatPrice(product.price)}</span>
                        <span className="text-xs text-muted-foreground">{product.quantity} available</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      {products.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-background py-16 text-center">
          <p className="font-medium text-foreground">No wares are visible yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Add products and enable “Show on wares page” to preview them here.</p>
        </div>
      )}
    </div>
  )
}
