"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileStickyCta } from "@/components/mobile-sticky-cta"
import { formatPrice } from "@/lib/pos-catalog"
import { upsertShopCartItem } from "@/lib/shop-cart"
import { trackAnalyticsEvent } from "@/lib/client-analytics"

interface ProductPurchaseActionsProps {
  productId: string
  productSlug: string
  productName: string
  productCategory: string
  price: number
  availableQuantity: number
}

export function ProductPurchaseActions({
  productId,
  productSlug,
  productName,
  productCategory,
  price,
  availableQuantity,
}: ProductPurchaseActionsProps) {
  const router = useRouter()
  const [added, setAdded] = useState(false)

  const addToCart = (goToCheckout: boolean) => {
    upsertShopCartItem(productId, 1, availableQuantity)
    setAdded(true)
    void trackAnalyticsEvent({
      type: goToCheckout ? "product_buy_now_click" : "product_add_to_cart",
      productId,
      productSlug,
      productName,
      productCategory,
      value: price,
      currency: "IDR",
      metadata: {
        availableQuantity,
      },
    })

    if (goToCheckout) {
      router.push("/shop/checkout")
    }
  }

  return (
    <>
      <div className="mt-8 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Button size="lg" onClick={() => addToCart(true)} disabled={availableQuantity < 1}>
            <ShoppingCart className="mr-2 h-5 w-5" />
            Add to cart and checkout
          </Button>
          <Button size="lg" variant="outline" onClick={() => addToCart(false)} disabled={availableQuantity < 1}>
            <ShoppingCart className="mr-2 h-5 w-5" />
            Add to cart
          </Button>
        </div>

        {added && (
          <div className="flex flex-col gap-3 rounded-sm border border-border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Added to cart.
            </span>
            <Button variant="ghost" size="sm" className="justify-start px-0 sm:px-2" onClick={() => router.push("/shop/checkout")}>
              Go to secure checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {availableQuantity > 0 && (
        <MobileStickyCta title={productName} detail={formatPrice(price)}>
          <Button className="h-11 px-4 text-sm" onClick={() => addToCart(true)}>
            Buy
          </Button>
        </MobileStickyCta>
      )}
    </>
  )
}
