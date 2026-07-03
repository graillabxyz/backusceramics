import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { getProduct, getAllProducts, formatPrice } from "@/lib/shop-data"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProductViewTracker } from "@/components/product-view-tracker"

interface ProductPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  const products = getAllProducts()
  return products.map((product) => ({
    slug: product.slug,
  }))
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = getProduct(slug)

  if (!product) {
    notFound()
  }

  const relatedProducts = getAllProducts()
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, 4)

  return (
    <main className="min-h-screen">
      <ProductViewTracker
        productId={product.id}
        productSlug={product.slug}
        productName={product.name}
        productCategory={product.category}
        value={product.price}
      />
      <Navigation />
      
      {/* Breadcrumb */}
      <section className="pt-28 pb-4 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/shop">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shop
            </Link>
          </Button>
        </div>
      </section>

      {/* Product Detail */}
      <section className="py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Product Images */}
            <div className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">Main Product Image</span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Img {i}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div>
              <div className="mb-4">
                <Badge variant="secondary">{product.category}</Badge>
              </div>
              <h1 className="font-heading font-bold text-3xl sm:text-4xl font-medium text-foreground mb-4">
                {product.name}
              </h1>
              <p className="text-3xl font-semibold text-foreground mb-6">
                {formatPrice(product.price)}
              </p>
              
              <div className="flex items-center gap-2 mb-6">
                {product.inStock ? (
                  <>
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-green-600 font-medium">In Stock</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">Sold Out</span>
                  </>
                )}
              </div>

              <p className="text-muted-foreground leading-relaxed mb-8">
                {product.description}
              </p>

              <div className="space-y-4 mb-8 p-6 bg-secondary/50 rounded-lg">
                <h3 className="font-medium text-foreground">Details</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Handcrafted in our Bali studio
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    High-fired stoneware clay
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Food safe and dishwasher safe
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Each piece is unique with subtle variations
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="flex-1" disabled={!product.inStock}>
                  {product.inStock ? "Inquire About This Piece" : "Sold Out"}
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/contact">
                    Contact Us
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-16 bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading font-bold text-2xl font-medium text-foreground mb-8">
              More {product.category}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  href={`/shop/${relatedProduct.slug}`}
                  className="group"
                >
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                      <span className="text-xs">Product Image</span>
                    </div>
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
                  </div>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors text-sm">
                    {relatedProduct.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatPrice(relatedProduct.price)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  )
}
