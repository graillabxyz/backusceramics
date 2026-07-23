"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, PackageCheck, ShoppingCart, Store, Trash2 } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MobileStickyCta } from "@/components/mobile-sticky-cta"
import { useAuth } from "@/lib/auth-context"
import { formatPrice } from "@/lib/pos-catalog"
import { clearShopCart, readShopCart, writeShopCart, type ShopCartItem } from "@/lib/shop-cart"
import { markCheckoutPaymentStarted, trackAnalyticsEvent } from "@/lib/client-analytics"
import { SHIPPING_DESTINATIONS } from "@/lib/shipping-destinations"

interface CartPreviewItem {
  productId: string
  slug: string
  name: string
  sku: string | null
  category: string
  price: number
  currency: string
  availableQuantity: number
  quantity: number
  image: string
  volumeMl: number | null
}

interface ShippingQuote {
  countryCode: string
  countryName: string
  service: string
  amount: number
  actualWeightKg: number
  volumetricWeightKg: number
  chargeableWeightKg: number
  packageLengthCm: number
  packageWidthCm: number
  packageHeightCm: number
  estimatedDelivery: string
  usedProductDefaults: boolean
  disclaimer: string
}

function friendlyCheckoutError(status: number, data: Record<string, unknown>) {
  if (status === 401 || data.code === "SHOP_AUTH_REQUIRED") {
    return "Please sign in before continuing to secure checkout."
  }

  if (status >= 500 || data.code === "SHOP_PAYMENT_CONFIGURATION_MISSING") {
    return "Payment could not be started right now. Please try again shortly."
  }

  return typeof data.error === "string" && data.error
    ? data.error
    : "Checkout could not be started. Please refresh and try again."
}

function ShopCheckoutContent() {
  const searchParams = useSearchParams()
  const productIdParam = searchParams.get("productId") || ""
  const paymentStatus = searchParams.get("payment") || ""
  const saleId = searchParams.get("sale") || ""
  const { user, isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth()
  const [cart, setCart] = useState<ShopCartItem[]>([])
  const [items, setItems] = useState<CartPreviewItem[]>([])
  const [receiptEmail, setReceiptEmail] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"PICKUP" | "SHIPPING">("PICKUP")
  const [shippingCountry, setShippingCountry] = useState("")
  const [shippingCity, setShippingCity] = useState("")
  const [shippingPostalCode, setShippingPostalCode] = useState("")
  const [shippingAddress, setShippingAddress] = useState("")
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isLoadingCart, setIsLoadingCart] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (paymentStatus === "success") {
      clearShopCart()
      setCart([])
      setItems([])
      setNotice("Thank you. Your payment return was received, and the order will update automatically after Xendit confirms it.")
    }

    if (paymentStatus === "cancelled") {
      setNotice("Payment was cancelled. If the piece is still available, you can restart checkout.")
    }
  }, [paymentStatus])

  useEffect(() => {
    if (user?.email && !receiptEmail) setReceiptEmail(user.email)
    if (user?.name && !customerName) setCustomerName(user.name)
  }, [customerName, receiptEmail, user])

  useEffect(() => {
    if (paymentStatus === "success") return

    const savedCart = readShopCart()
    const hasProductParam = productIdParam && !savedCart.some((item) => item.productId === productIdParam)
    const nextCart = hasProductParam ? [...savedCart, { productId: productIdParam, quantity: 1 }] : savedCart

    writeShopCart(nextCart)
    setCart(nextCart)
  }, [paymentStatus, productIdParam])

  const loadCartPreview = useCallback(async (cartItems: ShopCartItem[]) => {
    if (cartItems.length === 0) {
      setItems([])
      setIsLoadingCart(false)
      return
    }

    setIsLoadingCart(true)
    setError("")

    try {
      const res = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not load cart")
      }

      const previewItems = Array.isArray(data.items) ? data.items as CartPreviewItem[] : []
      const syncedCart = previewItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
      setItems(previewItems)
      setCart(syncedCart)
      writeShopCart(syncedCart)

      if (Array.isArray(data.unavailableProductIds) && data.unavailableProductIds.length > 0) {
        setNotice("Some pieces in your cart are no longer available and were removed.")
      }
    } catch (cartError) {
      console.error("Could not load shop cart", cartError)
      setError("Could not load your cart. Please refresh and try again.")
    } finally {
      setIsLoadingCart(false)
    }
  }, [])

  const cartSignature = useMemo(
    () => cart.map((item) => `${item.productId}:${item.quantity}`).join("|"),
    [cart]
  )

  useEffect(() => {
    void loadCartPreview(cart)
  }, [cartSignature, loadCartPreview])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items])
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
  const shippingAmount = fulfillmentMethod === "SHIPPING" ? shippingQuote?.amount || 0 : 0
  const total = subtotal + shippingAmount

  useEffect(() => {
    setShippingQuote(null)
  }, [cartSignature, shippingCountry])

  const calculateShipping = async () => {
    setError("")
    if (!shippingCountry) {
      setError("Choose a destination before calculating shipping.")
      return
    }

    setIsLoadingQuote(true)
    try {
      const res = await fetch("/api/shop/shipping-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: shippingCountry,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.quote) throw new Error(data.error || "Shipping could not be calculated.")
      setShippingQuote(data.quote as ShippingQuote)
    } catch (quoteError) {
      console.error("Shop shipping quote failed", quoteError)
      setError(quoteError instanceof Error ? quoteError.message : "Shipping could not be calculated.")
    } finally {
      setIsLoadingQuote(false)
    }
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const previewItem = items.find((item) => item.productId === productId)
    const safeQuantity = Math.min(Math.max(Math.round(quantity), 1), Math.max(previewItem?.availableQuantity || 1, 1))
    const nextCart = cart.map((item) => item.productId === productId ? { ...item, quantity: safeQuantity } : item)
    setCart(nextCart)
    setItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity: safeQuantity } : item))
    writeShopCart(nextCart)
  }

  const removeItem = (productId: string) => {
    const nextCart = cart.filter((item) => item.productId !== productId)
    setCart(nextCart)
    setItems((current) => current.filter((item) => item.productId !== productId))
    writeShopCart(nextCart)
  }

  const handlePayment = async () => {
    setError("")
    setNotice("")

    void trackAnalyticsEvent({
      type: "shop_checkout_payment_click",
      source: "online_shop",
      value: total,
      currency: "IDR",
      metadata: {
        itemCount,
        fulfillmentMethod,
        shippingAmount,
      },
    })

    if (authLoading && !isAuthenticated) {
      setError("We are finishing your sign-in. Please wait a moment.")
      return
    }

    if (!isAuthenticated) {
      openAuthModal("/shop/checkout")
      return
    }

    if (items.length === 0) {
      setError("Add an available piece before checkout.")
      return
    }

    if (!receiptEmail.trim()) {
      setError("Add an email address for your receipt.")
      return
    }

    if (fulfillmentMethod === "SHIPPING" && !shippingQuote) {
      setError("Calculate shipping before continuing to payment.")
      return
    }

    if (fulfillmentMethod === "SHIPPING" && (!shippingCity.trim() || !shippingPostalCode.trim() || shippingAddress.trim().length < 8)) {
      setError("Add the complete shipping city, postal code, and address.")
      return
    }

    setIsSubmitting(true)
    try {
      const returnPath = `${window.location.pathname}${window.location.search}`
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          receiptEmail: receiptEmail.trim(),
          customerName: customerName.trim(),
          fulfillmentMethod,
          shippingCountry,
          shippingCity: shippingCity.trim(),
          shippingPostalCode: shippingPostalCode.trim(),
          shippingAddress: shippingAddress.trim(),
        }),
      })

      const responseText = await res.text()
      let data: Record<string, unknown> = {}
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch {
        data = { rawResponse: responseText.slice(0, 1000) }
      }

      if (!res.ok) {
        console.error("Shop checkout failed", {
          status: res.status,
          response: data,
          request: {
            itemCount: items.length,
            subtotal,
            fulfillmentMethod,
          },
        })
        throw new Error(friendlyCheckoutError(res.status, data))
      }

      const paymentUrl = typeof data.paymentUrl === "string" ? data.paymentUrl : ""
      if (!paymentUrl) {
        console.error("Shop checkout response missing paymentUrl", { response: data })
        throw new Error("Payment could not be started right now. Please try again shortly.")
      }

      markCheckoutPaymentStarted(returnPath)
      await trackAnalyticsEvent({
        type: "shop_payment_start_success",
        source: "online_shop",
        value: total,
        currency: "IDR",
        metadata: {
          saleId: typeof data.saleId === "string" ? data.saleId : undefined,
          paymentReference: typeof data.paymentReference === "string" ? data.paymentReference : undefined,
          paymentSessionId: typeof data.paymentSessionId === "string" ? data.paymentSessionId : undefined,
          itemCount,
        },
      }, { beacon: true })
      window.location.href = paymentUrl
    } catch (checkoutError) {
      console.error("Shop payment checkout error", checkoutError)
      setError(checkoutError instanceof Error ? checkoutError.message : "Payment could not be started right now.")
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background pb-28 lg:pb-0">
      <Navigation />

      <section className="border-b border-border bg-secondary/25 pt-24 pb-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" asChild className="mb-4 -ml-2 gap-2 px-0">
            <Link href="/wall-of-cups">
              <ArrowLeft className="h-4 w-4" />
              Back to Wall of Cups
            </Link>
          </Button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Secure checkout</p>
              <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Review your cart.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Online payment reserves the selected piece while Xendit confirms payment. Choose free shop pickup or calculate protected ceramic shipping before paying.
              </p>
            </div>
            <div className="flex w-fit rounded-md border border-border bg-background p-1 text-xs font-medium text-muted-foreground">
              <span className="px-2.5 py-1">1. Choose</span>
              <span className="rounded bg-primary px-2.5 py-1 text-primary-foreground">2. Pay</span>
              <span className="px-2.5 py-1">3. Collect</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-4">
          {notice && (
            <Alert>
              <AlertTitle>Checkout update</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Could not continue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="border-border">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-foreground">Cart</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
                </div>
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              </div>

              {isLoadingCart ? (
                <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cart
                </div>
              ) : items.length > 0 ? (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.productId} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 px-4 py-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5 sm:py-5">
                      <Link href={`/shop/${item.slug}`} className="block h-[76px] w-[76px] overflow-hidden rounded-sm bg-muted sm:h-auto sm:w-auto">
                        <div className="aspect-square">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                          )}
                        </div>
                      </Link>

                      <div className="min-w-0">
                        <Link href={`/shop/${item.slug}`} className="font-heading text-xl font-bold text-foreground hover:text-primary">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[item.volumeMl ? `${item.volumeMl} ml` : "", item.sku || ""].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">{formatPrice(item.price)} each</p>
                      </div>

                      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
                        <div className="flex items-center rounded-md border border-border">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 px-0"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            -
                          </Button>
                          <span className="min-w-9 text-center text-sm font-semibold">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 px-0"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.availableQuantity}
                          >
                            +
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold text-foreground">{formatPrice(item.price * item.quantity)}</p>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.productId)} aria-label={`Remove ${item.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-16 text-center">
                  <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h2 className="mt-4 font-heading text-2xl font-bold text-foreground">Your cart is empty</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Choose a cup from the Wall of Cups to begin.</p>
                  <Button asChild className="mt-6">
                    <Link href="/wall-of-cups">Browse cups</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Card className="border-border">
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground">Payment summary</h2>
                <p className="mt-1 text-sm text-muted-foreground">Secure payment by Xendit.</p>
              </div>

              <div className="space-y-2 border-y border-border py-4 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{fulfillmentMethod === "SHIPPING" ? "Packing and shipping" : "Shop pickup"}</span>
                  <span>{fulfillmentMethod === "SHIPPING" ? (shippingQuote ? formatPrice(shippingAmount) : "Not calculated") : "Free"}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Receive your order</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={fulfillmentMethod === "PICKUP" ? "default" : "outline"}
                    className="h-auto justify-start gap-2 py-3"
                    onClick={() => setFulfillmentMethod("PICKUP")}
                  >
                    <Store className="h-4 w-4" />
                    Shop pickup
                  </Button>
                  <Button
                    type="button"
                    variant={fulfillmentMethod === "SHIPPING" ? "default" : "outline"}
                    className="h-auto justify-start gap-2 py-3"
                    onClick={() => setFulfillmentMethod("SHIPPING")}
                  >
                    <PackageCheck className="h-4 w-4" />
                    Ship it
                  </Button>
                </div>
              </div>

              {fulfillmentMethod === "SHIPPING" && (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="shop-shipping-country">Destination country</Label>
                    <select
                      id="shop-shipping-country"
                      value={shippingCountry}
                      onChange={(event) => setShippingCountry(event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose a country</option>
                      {SHIPPING_DESTINATIONS.map((destination) => (
                        <option key={destination.code} value={destination.code}>{destination.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={calculateShipping} disabled={isLoadingQuote || items.length === 0}>
                    {isLoadingQuote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                    {shippingQuote ? "Recalculate shipping" : "Calculate shipping"}
                  </Button>
                  {shippingQuote && (
                    <div className="space-y-1 rounded-md bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                      <div className="flex justify-between gap-3 font-semibold text-foreground">
                        <span>{shippingQuote.service}</span>
                        <span>{formatPrice(shippingQuote.amount)}</span>
                      </div>
                      <p>{shippingQuote.chargeableWeightKg} kg chargeable · {shippingQuote.packageLengthCm} × {shippingQuote.packageWidthCm} × {shippingQuote.packageHeightCm} cm packed</p>
                      <p>Estimated {shippingQuote.estimatedDelivery}. Duties and destination taxes are not included.</p>
                      {shippingQuote.usedProductDefaults && <p>Some piece measurements use protective category defaults; the server will verify the same estimate before payment.</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="shop-shipping-city">City</Label>
                      <Input id="shop-shipping-city" value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shop-shipping-postcode">Postal code</Label>
                      <Input id="shop-shipping-postcode" value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop-shipping-address">Complete address</Label>
                    <Textarea id="shop-shipping-address" rows={3} value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="shop-customer-name">Name</Label>
                <Input
                  id="shop-customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shop-receipt-email">Receipt email</Label>
                <Input
                  id="shop-receipt-email"
                  type="email"
                  value={receiptEmail}
                  onChange={(event) => setReceiptEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <Button size="lg" className="hidden w-full lg:inline-flex" onClick={handlePayment} disabled={isSubmitting || isLoadingCart || items.length === 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting payment
                  </>
                ) : !isAuthenticated ? (
                  "Sign in to checkout"
                ) : (
                  "Continue to secure payment"
                )}
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Your cart is validated again on the server before payment. If another customer buys the same piece first,
                checkout will ask you to choose again.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>

      <MobileStickyCta
        title={formatPrice(total)}
        detail={
          error
            ? <span className="text-destructive">{error}</span>
            : itemCount === 0
              ? "Your cart is empty"
              : `${itemCount} ${itemCount === 1 ? "item" : "items"} ready for secure payment`
        }
      >
        <Button
          className="h-11 px-4 text-sm"
          onClick={handlePayment}
          disabled={isSubmitting || isLoadingCart || items.length === 0}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Starting" : !isAuthenticated ? "Sign in" : "Pay"}
        </Button>
      </MobileStickyCta>

      <Footer />
    </main>
  )
}

export default function ShopCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <Navigation />
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
            Loading checkout...
          </div>
          <Footer />
        </main>
      }
    >
      <ShopCheckoutContent />
    </Suspense>
  )
}
