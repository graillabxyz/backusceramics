"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { getAllProducts, categories, formatPrice, getProductsByCategory } from "@/lib/shop-data"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const products = getProductsByCategory(selectedCategory)

  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground tracking-tight">
              The Wall of Cups
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Each piece is handcrafted in our Bali studio. Browse our collection 
              of cups, bowls, and ceramic wares. Every item is unique with subtle 
              variations that make it one of a kind.
            </p>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/shop/${product.slug}`}
                className="group"
              >
                <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4 relative">
                  {/* Placeholder for product image */}
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                    <span className="text-xs text-center px-4">Product Image</span>
                  </div>
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
                  {!product.inStock && (
                    <Badge variant="secondary" className="absolute top-3 left-3">
                      Sold Out
                    </Badge>
                  )}
                  {product.featured && product.inStock && (
                    <Badge className="absolute top-3 left-3">
                      Featured
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{product.category}</p>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors text-sm sm:text-base">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No products found in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-2xl font-medium text-foreground mb-4">
            Interested in a Piece?
          </h2>
          <p className="text-muted-foreground mb-6">
            Each piece is handmade and variations make every item unique. 
            Contact us to check availability or discuss custom orders.
          </p>
          <Button asChild size="lg">
            <Link href="/contact">
              Get in Touch
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  )
}
