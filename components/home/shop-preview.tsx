import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

const featuredProducts = [
  { id: 1, name: "Espresso Cup", price: 450000 },
  { id: 2, name: "Tea Bowl", price: 380000 },
  { id: 3, name: "Coffee Mug", price: 520000 },
  { id: 4, name: "Matcha Bowl", price: 620000 },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price)
}

export function ShopPreview() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl text-foreground tracking-tight">
            The Wall of Cups
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Each piece is handcrafted with care. Browse our collection and find your perfect cup.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/shop/${product.id}`}
              className="group"
            >
              <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4 relative">
                {/* Placeholder for product image */}
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                  <span className="text-sm">Product Image</span>
                </div>
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
              </div>
              <h3 className="font-heading font-bold text-foreground group-hover:text-primary transition-colors">
                {product.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatPrice(product.price)}
              </p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button asChild variant="outline" size="lg">
            <Link href="/shop">
              View All Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
