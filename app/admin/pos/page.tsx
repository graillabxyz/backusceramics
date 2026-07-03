"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatPrice,
  getProductCategoryLabel,
  normalizeProductCategory,
  parseProductImageUrls,
  POS_PAYMENT_METHODS,
  POS_PRODUCT_CATEGORIES,
} from "@/lib/pos-catalog"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react"

interface PosProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  description: string | null
  imageUrls: string | null
  price: number
  currency: string
  category: string
  quantity: number
  status: string
  cafeOnly: boolean
  showInShop: boolean
  featured: boolean
  sortOrder: number
  createdAt: string
}

interface CartItem {
  product: PosProduct
  quantity: number
}

interface QuickProductForm {
  name: string
  sku: string
  category: string
  price: string
  quantity: string
  cafeOnly: boolean
  showInShop: boolean
}

const quickProductDefaults: QuickProductForm = {
  name: "",
  sku: "",
  category: "CUPS",
  price: "",
  quantity: "1",
  cafeOnly: false,
  showInShop: true,
}

function firstImage(product: PosProduct) {
  return parseProductImageUrls(product.imageUrls)[0] || ""
}

export default function AdminPosPage() {
  const posRootRef = useRef<HTMLDivElement | null>(null)
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [activeCategory, setActiveCategory] = useState("ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [receiptEmail, setReceiptEmail] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CARD_MACHINE")
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [quickProduct, setQuickProduct] = useState<QuickProductForm>(quickProductDefaults)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const availableProducts = useMemo(
    () => products.filter((product) => product.status === "AVAILABLE" && product.quantity > 0),
    [products]
  )

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return availableProducts.filter((product) => {
      const matchesCategory = activeCategory === "ALL" || normalizeProductCategory(product.category) === activeCategory
      const matchesSearch = !search || [product.name, product.sku || "", product.description || ""]
        .some((value) => value.toLowerCase().includes(search))
      return matchesCategory && matchesSearch
    })
  }, [activeCategory, availableProducts, searchTerm])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  )

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === posRootRef.current)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false)
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFullscreen])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/pos/products")
      if (!res.ok) throw new Error("Could not load products")
      setProducts(await res.json())
    } catch (loadError) {
      console.error("POS products load failed", loadError)
      setError("Could not load POS products.")
    } finally {
      setLoading(false)
    }
  }

  const openQuickAdd = () => {
    setQuickProduct(quickProductDefaults)
    setError("")
    setIsQuickAddOpen(true)
  }

  const updateQuickProduct = <K extends keyof QuickProductForm>(key: K, value: QuickProductForm[K]) => {
    setQuickProduct((current) => {
      if (key === "cafeOnly" && value === true) {
        return { ...current, cafeOnly: true, showInShop: false, category: "F_AND_B" }
      }

      if (key === "cafeOnly" && value === false && current.category === "F_AND_B") {
        return { ...current, cafeOnly: false, showInShop: true, category: "CUPS" }
      }

      if (key === "category" && value === "F_AND_B") {
        return { ...current, category: value, cafeOnly: true, showInShop: false }
      }

      return { ...current, [key]: value }
    })
  }

  const handleQuickAddProduct = async () => {
    setSavingProduct(true)
    setError("")
    setSuccess("")

    const payload = {
      ...quickProduct,
      price: Number(quickProduct.price),
      quantity: Number(quickProduct.quantity || 1),
      status: "AVAILABLE",
      showInShop: quickProduct.cafeOnly ? false : quickProduct.showInShop,
    }

    try {
      const res = await fetch("/api/pos/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Could not add product")
        return
      }

      setProducts((current) => [data, ...current])
      setActiveCategory(normalizeProductCategory(data.category))
      setSearchTerm("")
      setSuccess(`${data.name} was added to POS inventory.`)
      setIsQuickAddOpen(false)
      setQuickProduct(quickProductDefaults)
    } catch (productError) {
      console.error("Quick POS product add failed", productError)
      setError("Could not add product.")
    } finally {
      setSavingProduct(false)
    }
  }

  const addToCart = (product: PosProduct) => {
    setSuccess("")
    setError("")
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) return current
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...current, { product, quantity: 1 }]
    })
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart((current) => {
      if (quantity <= 0) return current.filter((item) => item.product.id !== productId)
      return current.map((item) => {
        if (item.product.id !== productId) return item
        return { ...item, quantity: Math.min(quantity, item.product.quantity) }
      })
    })
  }

  const clearCheckoutState = () => {
    setCart([])
    setReceiptEmail("")
    setCustomerName("")
    setPaymentMethod("CARD_MACHINE")
  }

  const checkoutPayload = () => ({
    items: cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    })),
    receiptEmail: receiptEmail.trim() || undefined,
    customerName: customerName.trim() || undefined,
  })

  const handleMachinePaid = async () => {
    if (cart.length === 0) return

    setCheckingOut(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutPayload(),
          paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not complete sale")
        return
      }

      setSuccess(receiptEmail.trim() ? "Sale recorded and receipt email queued." : "Sale recorded.")
      clearCheckoutState()
      await fetchProducts()
    } catch (checkoutError) {
      console.error("Machine POS checkout failed", checkoutError)
      setError("Could not complete sale.")
    } finally {
      setCheckingOut(false)
    }
  }

  const handleOnlinePayment = async () => {
    if (cart.length === 0) return

    setOnlineLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/pos/sales/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload()),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not start online payment")
        return
      }

      if (typeof data.paymentUrl !== "string" || !data.paymentUrl) {
        setError("Online payment link was not returned.")
        return
      }

      window.location.href = data.paymentUrl
    } catch (paymentError) {
      console.error("POS online payment failed", paymentError)
      setError("Could not start online payment.")
    } finally {
      setOnlineLoading(false)
    }
  }

  const enterFullscreen = async () => {
    const element = posRootRef.current
    if (!element) return

    setError("")
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      }
      setIsFullscreen(true)
    } catch (fullscreenError) {
      console.error("Could not enter browser fullscreen for POS", fullscreenError)
      setIsFullscreen(true)
    }
  }

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
      }
    } catch (fullscreenError) {
      console.error("Could not exit browser fullscreen for POS", fullscreenError)
    } finally {
      setIsFullscreen(false)
    }
  }

  const toggleFullscreen = () => {
    if (isFullscreen) {
      void exitFullscreen()
      return
    }

    void enterFullscreen()
  }

  return (
    <div
      ref={posRootRef}
      className={cn(
        "space-y-6",
        isFullscreen && "fixed inset-0 z-[80] overflow-auto bg-muted/30 p-4 sm:p-5 lg:p-6"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Point of Sale</h1>
          <p className="mt-1 text-muted-foreground">
            Fast cashier checkout for ceramic wares and cafe-only items.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Available products</p>
              <p className="text-2xl font-semibold text-foreground">{availableProducts.length}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Cart</p>
              <p className="text-2xl font-semibold text-foreground">{cartCount}</p>
            </div>
          </div>
          <Button
            type="button"
            variant={isFullscreen ? "secondary" : "outline"}
            className="h-auto min-h-12 sm:min-w-40"
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen POS"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 font-heading text-xl">
                <Store className="h-5 w-5" />
                Products
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row md:items-center">
                <Button type="button" onClick={openQuickAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add product
                </Button>
                <div className="relative md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search POS..."
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="mb-5 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                <TabsTrigger value="ALL" className="rounded-full border border-border px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  All
                </TabsTrigger>
                {POS_PRODUCT_CATEGORIES.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="rounded-full border border-border px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeCategory} className="mt-0">
                {loading ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-24 text-center">
                    <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="font-medium text-foreground">No available products here</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try another category or add inventory right here.</p>
                    <Button type="button" className="mt-5" onClick={openQuickAdd}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add product
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "grid gap-3 sm:grid-cols-2",
                      isFullscreen ? "xl:grid-cols-3 2xl:grid-cols-4" : "2xl:grid-cols-3"
                    )}
                  >
                    {filteredProducts.map((product) => {
                      const image = firstImage(product)
                      const inCart = cart.find((item) => item.product.id === product.id)?.quantity || 0

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addToCart(product)}
                          className="group overflow-hidden rounded-md border border-border bg-background text-left shadow-sm transition hover:border-primary hover:shadow-md"
                        >
                          <div className="aspect-[4/3] bg-muted">
                            {image ? (
                              <img src={image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold leading-snug text-foreground">{product.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{product.sku || getProductCategoryLabel(product.category)}</p>
                              </div>
                              {product.cafeOnly && <Badge variant="outline">Cafe</Badge>}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-foreground">{formatPrice(product.price)}</p>
                              <p className="text-xs text-muted-foreground">{product.quantity - inCart} left</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isFullscreen
              ? "lg:sticky lg:top-0 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto"
              : "lg:sticky lg:top-20 lg:self-start xl:top-6"
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between font-heading text-xl">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Checkout
              </span>
              <Badge variant="secondary">{cartCount} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {cart.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-12 text-center">
                <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Tap products to add them here.</p>
              </div>
            ) : (
              <div className={cn("space-y-3", isFullscreen && "lg:max-h-[26vh] lg:overflow-y-auto lg:pr-1")}>
                {cart.map((item) => (
                  <div key={item.product.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">{formatPrice(item.product.price)}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => updateCartQuantity(item.product.id, 0)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <Button variant="outline" size="icon" onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="font-semibold text-foreground">{formatPrice(item.product.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-md bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xl font-bold text-foreground">
                <span>Total</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="receiptEmail" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Receipt email
                </Label>
                <Input
                  id="receiptEmail"
                  type="email"
                  value={receiptEmail}
                  onChange={(event) => setReceiptEmail(event.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label>Machine payment type</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_PAYMENT_METHODS.filter((method) => method !== "ONLINE").map((method) => (
                      <SelectItem key={method} value={method}>
                        {method === "CARD_MACHINE" ? "Card machine" : method.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                className="h-14 w-full text-base"
                onClick={handleMachinePaid}
                disabled={cart.length === 0 || checkingOut || onlineLoading}
              >
                {checkingOut ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                Paid with card machine
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleOnlinePayment}
                disabled={cart.length === 0 || checkingOut || onlineLoading}
              >
                {onlineLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Finish payment online
              </Button>

              {cart.length > 0 && (
                <Button variant="ghost" className="w-full" onClick={clearCheckoutState}>
                  Clear cart
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Add product to POS</DialogTitle>
            <DialogDescription>
              Use this for quick cashier inventory. Detailed photos and long descriptions can still be edited later in Products.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="quickName">Product name</Label>
              <Input
                id="quickName"
                value={quickProduct.name}
                onChange={(event) => updateQuickProduct("name", event.target.value)}
                placeholder="e.g., Blue cup, iced latte, incense holder"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quickSku">SKU or shelf code</Label>
              <Input
                id="quickSku"
                value={quickProduct.sku}
                onChange={(event) => updateQuickProduct("sku", event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={quickProduct.category} onValueChange={(category) => updateQuickProduct("category", category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POS_PRODUCT_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quickPrice">Price (IDR)</Label>
              <Input
                id="quickPrice"
                inputMode="numeric"
                value={quickProduct.price}
                onChange={(event) => updateQuickProduct("price", event.target.value)}
                placeholder="250000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quickQuantity">Quantity</Label>
              <Input
                id="quickQuantity"
                inputMode="numeric"
                value={quickProduct.quantity}
                onChange={(event) => updateQuickProduct("quantity", event.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="quickCafeOnly">Cafe only</Label>
                <p className="text-xs text-muted-foreground">F&B and cashier-only items.</p>
              </div>
              <Switch
                id="quickCafeOnly"
                checked={quickProduct.cafeOnly}
                onCheckedChange={(checked) => updateQuickProduct("cafeOnly", checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="quickShowInShop">Show on wares page</Label>
                <p className="text-xs text-muted-foreground">Keep off for cafe-only products.</p>
              </div>
              <Switch
                id="quickShowInShop"
                checked={quickProduct.showInShop && !quickProduct.cafeOnly}
                disabled={quickProduct.cafeOnly}
                onCheckedChange={(checked) => updateQuickProduct("showInShop", checked)}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 sm:col-span-2">
              <div className="flex items-start gap-3">
                <ShoppingBag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  New products are immediately available on this POS. Use the Products page later for images, descriptions, featured placement, or archiving.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddProduct} disabled={savingProduct}>
              {savingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to POS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
