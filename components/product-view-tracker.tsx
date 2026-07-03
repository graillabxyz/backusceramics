"use client"

import { useEffect } from "react"
import { trackAnalyticsEvent } from "@/lib/client-analytics"

interface ProductViewTrackerProps {
  productId: string
  productSlug: string
  productName: string
  productCategory: string
  value?: number | null
}

export function ProductViewTracker({
  productId,
  productSlug,
  productName,
  productCategory,
  value,
}: ProductViewTrackerProps) {
  useEffect(() => {
    trackAnalyticsEvent({
      type: "product_view",
      productId,
      productSlug,
      productName,
      productCategory,
      value,
      metadata: {
        surface: "shop_product_page",
      },
    })
  }, [productCategory, productId, productName, productSlug, value])

  return null
}
