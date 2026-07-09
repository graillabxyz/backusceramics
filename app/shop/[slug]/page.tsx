import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ProductViewTracker } from "@/components/product-view-tracker"
import { ProductPurchaseActions } from "@/components/shop/product-purchase-actions"
import { prisma } from "@/lib/prisma"
import { formatPrice, parseProductImageUrls } from "@/lib/pos-catalog"

export const dynamic = "force-dynamic"

interface ProductPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await prisma.posProduct
    .findFirst({
      where: {
        slug,
        category: "CUPS",
        status: "AVAILABLE",
        showInShop: true,
        cafeOnly: false,
        quantity: { gt: 0 },
      },
    })
    .catch((error) => {
      console.error("Could not load Wall of Cups product", { slug, error })
      return null
    })

  if (!product) {
    notFound()
  }

  const images = parseProductImageUrls(product.imageUrls)
  const mainImage = images[0] || ""
  const relatedProducts = await prisma.posProduct
    .findMany({
      where: {
        id: { not: product.id },
        category: "CUPS",
        status: "AVAILABLE",
        showInShop: true,
        cafeOnly: false,
        quantity: { gt: 0 },
      },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
      take: 4,
    })
    .catch((error) => {
      console.error("Could not load related Wall of Cups products", { productId: product.id, error })
      return []
    })
  return (
    <main className="min-h-screen bg-background">
      <ProductViewTracker
        productId={product.id}
        productSlug={product.slug}
        productName={product.name}
        productCategory={product.category}
        value={product.price}
      />
      <Navigation />

      <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
            <Link href="/wall-of-cups">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Wall of Cups
            </Link>
          </Button>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-start">
            <div className="space-y-3">
              <a
                href={mainImage || undefined}
                target={mainImage ? "_blank" : undefined}
                rel={mainImage ? "noopener noreferrer" : undefined}
                className="block overflow-hidden rounded-sm bg-muted"
                aria-label={mainImage ? `Open larger image of ${product.name}` : undefined}
              >
                <div className="aspect-[4/5]">
                  {mainImage ? (
                    <img src={mainImage} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                      Image coming soon
                    </div>
                  )}
                </div>
              </a>

              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {images.slice(1, 5).map((image) => (
                    <a key={image} href={image} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-sm bg-muted">
                      <img src={image} alt="" className="aspect-square w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Wall of Cups</p>
              <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {product.name}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {product.volumeMl && <span>{product.volumeMl} ml</span>}
                {product.sku && <span>{product.sku}</span>}
                <span>{product.quantity} available</span>
              </div>
              <p className="mt-8 text-3xl font-semibold text-foreground">{formatPrice(product.price)}</p>

              {product.description && (
                <p className="mt-8 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              )}

              <div className="mt-10 border-y border-border py-5 text-sm leading-relaxed text-muted-foreground">
                Handcrafted in the Backus Ceramics studio. Each cup is unique, functional, and intended for regular use.
              </div>

              <ProductPurchaseActions
                productId={product.id}
                productSlug={product.slug}
                productName={product.name}
                productCategory={product.category}
                price={product.price}
                availableQuantity={product.quantity}
              />

              <Button asChild variant="outline" size="lg" className="mt-3 w-full">
                <Link href="/wall-of-cups">
                  Keep browsing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="border-t border-border px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-heading text-3xl font-bold text-foreground">More cups</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((relatedProduct) => {
                const relatedImage = parseProductImageUrls(relatedProduct.imageUrls)[0] || ""

                return (
                  <Link
                    key={relatedProduct.id}
                    href={`/shop/${relatedProduct.slug}`}
                    className="group relative block overflow-hidden rounded-sm bg-muted"
                  >
                    <div className="aspect-[3/4]">
                      {relatedImage ? (
                        <img
                          src={relatedImage}
                          alt={relatedProduct.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          Image coming soon
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3 pt-14 text-white">
                      <h3 className="truncate font-heading text-lg font-bold">{relatedProduct.name}</h3>
                      <p className="mt-1 text-sm text-white/75">{formatPrice(relatedProduct.price)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  )
}
