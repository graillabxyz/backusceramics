"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
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
              <div className="relative aspect-square">
                {cup.image ? (
                  <Image
                    src={cup.image}
                    alt={cup.name}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Image coming soon</div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-20 text-white">
                <h2 className="break-words font-heading text-xl font-bold leading-tight">{cup.name}</h2>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-white/75">{cup.volumeMl ? `${cup.volumeMl} ml` : "One of one"}</span>
                  <span className="shrink-0 font-semibold">{formatPrice(cup.price)}</span>
                </div>
              </div>
            </Link>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={`absolute right-3 top-3 z-10 h-10 w-10 rounded-full border border-white/30 bg-black/55 text-white shadow-sm backdrop-blur transition-opacity hover:bg-black/80 hover:text-white focus-visible:opacity-100 ${added ? "opacity-100" : "opacity-80 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100"}`}
              onClick={() => addToCart(cup)}
              disabled={added}
              aria-label={added ? `${cup.name} added to cart` : `Add ${cup.name} to cart`}
              title={added ? "Added to cart" : "Add to cart"}
            >
              {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              <span className="sr-only">{added ? "Added to cart" : "Add to cart"}</span>
            </Button>
          </article>
        )
      })}
    </div>
  )
}
