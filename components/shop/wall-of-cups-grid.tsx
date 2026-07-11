"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/pos-catalog"
import { upsertShopCartItem } from "@/lib/shop-cart"
import { trackAnalyticsEvent } from "@/lib/client-analytics"

export interface WallCup {
  id: string
  slug: string
  name: string
  category: string
  price: number
  quantity: number
  volumeMl: number | null
  image: string
}

export function WallOfCupsGrid({ cups }: { cups: WallCup[] }) {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const addToCart = (cup: WallCup) => {
    upsertShopCartItem(cup.id, 1, cup.quantity)
    setAddedIds((current) => new Set(current).add(cup.id))
    void trackAnalyticsEvent({
      type: "product_add_to_cart",
      productId: cup.id,
      productSlug: cup.slug,
      productName: cup.name,
      productCategory: cup.category,
      value: cup.price,
      currency: "IDR",
      source: "wall_of_cups",
      metadata: { availableQuantity: cup.quantity },
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cups.map((cup) => {
        const added = addedIds.has(cup.id)
        return (
          <article key={cup.id} className="group relative overflow-hidden rounded-sm bg-muted">
            <Link href={`/shop/${cup.slug}`} className="block" aria-label={`View ${cup.name}`}>
              <div className="aspect-[3/4]">
                {cup.image ? (
                  <img src={cup.image} alt={cup.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Image coming soon</div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pb-16 pt-24 text-white">
                <h2 className="break-words font-heading text-xl font-bold leading-tight">{cup.name}</h2>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-white/75">{cup.volumeMl ? `${cup.volumeMl} ml` : "One of one"}</span>
                  <span className="shrink-0 font-semibold">{formatPrice(cup.price)}</span>
                </div>
              </div>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 text-black hover:bg-white"
              onClick={() => addToCart(cup)}
              disabled={added}
            >
              {added ? <Check className="mr-2 h-4 w-4" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              {added ? "Added to cart" : "Add to cart"}
            </Button>
          </article>
        )
      })}
    </div>
  )
}
