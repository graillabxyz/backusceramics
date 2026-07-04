"use client"

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import {
  formatPrice,
  getProductCategoryLabel,
  isCupCategory,
  normalizeProductCategory,
  parseProductImageUrls,
  POS_PRODUCT_CATEGORIES,
  POS_PRODUCT_STATUSES,
} from "@/lib/pos-catalog"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  CreditCard,
  ImagePlus,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import {
  calculatePosLineTotals,
  normalizePosDiscountType,
  normalizePosTaxRate,
  type PosDiscountType,
  type PosTaxRate,
} from "@/lib/pos-sale-calculations"

interface PosProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  description: string | null
  volumeMl: number | null
  imageUrls: string | null
  price: number
  currency: string
  category: string
  quantity: number
  status: string
  cafeOnly: boolean
  showInShop: boolean
  featured: boolean
  createdAt: string
}

interface CartItem {
  product: PosProduct
  quantity: number
  taxRate: PosTaxRate
  discountType: PosDiscountType
  discountValue: string
}

interface QuickProductForm {
  name: string
  sku: string
  category: string
  description: string
  volumeMl: string
  imageUrls: string
  price: string
  quantity: string
  status: string
  cafeOnly: boolean
  showInShop: boolean
  featured: boolean
}

const quickProductDefaults: QuickProductForm = {
  name: "",
  sku: "",
  category: "CUPS",
  description: "",
  volumeMl: "",
  imageUrls: "",
  price: "",
  quantity: "1",
  status: "AVAILABLE",
  cafeOnly: false,
  showInShop: true,
  featured: false,
}

function firstImage(product: PosProduct) {
  return parseProductImageUrls(product.imageUrls)[0] || ""
}

function cupVolumeLabel(product: PosProduct) {
  return isCupCategory(product.category) && product.volumeMl ? `${product.volumeMl} ml` : ""
}

function defaultTaxRate(product: PosProduct): PosTaxRate {
  return normalizeProductCategory(product.category) === "F_AND_B" ? 15 : 10
}

function toImageText(value: string | null) {
  return parseProductImageUrls(value).join("\n")
}

function cartLineTotals(item: CartItem) {
  return calculatePosLineTotals({
    unitPrice: item.product.price,
    quantity: item.quantity,
    taxRate: item.taxRate,
    discountType: item.discountType,
    discountValue: Number(item.discountValue || 0),
  })
}

const POS_PAYMENT_OPTIONS = [
  { value: "CARD_MACHINE", label: "Card" },
  { value: "QRIS", label: "QRIS" },
  { value: "CASH", label: "Cash" },
  { value: "TRANSFER", label: "Transfer" },
] as const

function paymentCompletionLabel(method: string) {
  if (method === "CASH") return "Record cash payment"
  if (method === "QRIS") return "Paid with QRIS"
  if (method === "TRANSFER") return "Record transfer payment"
  return "Paid with card machine"
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
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUploadNotice, setImageUploadNotice] = useState("")
  const [imageUploadError, setImageUploadError] = useState("")
  const [quickProduct, setQuickProduct] = useState<QuickProductForm>(quickProductDefaults)
  const [editingProduct, setEditingProduct] = useState<PosProduct | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [posStep, setPosStep] = useState<"CATEGORIES" | "ITEMS" | "CHECKOUT">("CATEGORIES")

  const posProducts = useMemo(
    () => products.filter((product) => product.quantity > 0 && product.status !== "SOLD" && product.status !== "ARCHIVED"),
    [products]
  )

  const availableProducts = useMemo(
    () => posProducts.filter((product) => product.status === "AVAILABLE" && product.price > 0),
    [posProducts]
  )

  const draftProducts = useMemo(
    () => posProducts.filter((product) => product.status !== "AVAILABLE" || product.price <= 0),
    [posProducts]
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

  const categoryCounts = useMemo(() => {
    return POS_PRODUCT_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
      counts[category.id] = availableProducts.filter((product) => normalizeProductCategory(product.category) === category.id).length
      return counts
    }, {})
  }, [availableProducts])

  const cartSummary = useMemo(
    () => cart.reduce((summary, item) => {
      const totals = cartLineTotals(item)
      return {
        subtotal: summary.subtotal + totals.subtotal,
        discountTotal: summary.discountTotal + totals.discountAmount,
        taxTotal: summary.taxTotal + totals.taxAmount,
        total: summary.total + totals.total,
      }
    }, { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }),
    [cart]
  )

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )
  const quickProductIsCup = isCupCategory(quickProduct.category)
  const quickProductIsDraft = quickProduct.status === "DRAFT"
  const quickProductImages = useMemo(() => parseProductImageUrls(quickProduct.imageUrls), [quickProduct.imageUrls])

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    if (params.get("posFullscreen") === "1" || window.localStorage.getItem("backus-pos-fullscreen") === "1") {
      window.localStorage.setItem("backus-pos-fullscreen", "1")
      setIsFullscreen(true)
      window.dispatchEvent(new CustomEvent("backus-pos-kiosk-change", { detail: { enabled: true } }))
    }
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
    setEditingProduct(null)
    setImageUploadNotice("")
    setImageUploadError("")
    setError("")
    setIsQuickAddOpen(true)
  }

  const openQuickEdit = (product: PosProduct) => {
    setEditingProduct(product)
    setQuickProduct({
      name: product.name,
      sku: product.sku || "",
      category: normalizeProductCategory(product.category),
      description: product.description || "",
      volumeMl: product.volumeMl ? product.volumeMl.toString() : "",
      imageUrls: toImageText(product.imageUrls),
      price: product.price ? product.price.toString() : "",
      quantity: product.quantity.toString(),
      status: product.status,
      cafeOnly: product.cafeOnly,
      showInShop: product.showInShop,
      featured: product.featured,
    })
    setImageUploadNotice("")
    setImageUploadError("")
    setError("")
    setSuccess("")
    setIsQuickEditOpen(true)
  }

  const updateQuickProduct = <K extends keyof QuickProductForm>(key: K, value: QuickProductForm[K]) => {
    setQuickProduct((current) => {
      if (key === "cafeOnly" && value === true) {
        return { ...current, cafeOnly: true, showInShop: false, category: "F_AND_B", volumeMl: "" }
      }

      if (key === "cafeOnly" && value === false && current.category === "F_AND_B") {
        return { ...current, cafeOnly: false, showInShop: true, category: "CUPS" }
      }

      if (key === "category") {
        const category = String(value)
        if (category === "F_AND_B") {
          return { ...current, category, cafeOnly: true, showInShop: false, volumeMl: "" }
        }
        if (!isCupCategory(category)) {
          return { ...current, category, volumeMl: "" }
        }
        return { ...current, category }
      }

      if (key === "status" && value === "DRAFT") {
        return { ...current, status: "DRAFT", showInShop: false, featured: false }
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
      price: quickProduct.price.trim() ? Number(quickProduct.price) : null,
      quantity: quickProduct.quantity.trim() ? Number(quickProduct.quantity) : null,
      volumeMl: isCupCategory(quickProduct.category) && quickProduct.volumeMl.trim()
        ? Number(quickProduct.volumeMl)
        : null,
      imageUrls: quickProductImages,
      status: quickProduct.status,
      showInShop: quickProduct.cafeOnly || quickProductIsDraft ? false : quickProduct.showInShop,
      featured: quickProductIsDraft ? false : quickProduct.featured,
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
      setActiveCategory("ALL")
      setPosStep("CATEGORIES")
      setSearchTerm("")
      setSuccess(data.status === "DRAFT" ? `${data.name} was saved as a draft.` : `${data.name} was added to POS inventory.`)
      setIsQuickAddOpen(false)
      setQuickProduct(quickProductDefaults)
    } catch (productError) {
      console.error("Quick POS product add failed", productError)
      setError("Could not add product.")
    } finally {
      setSavingProduct(false)
    }
  }

  const handleQuickEditProduct = async () => {
    if (!editingProduct) return

    setSavingProduct(true)
    setError("")
    setSuccess("")

    const payload = {
      ...quickProduct,
      price: quickProduct.price.trim() ? Number(quickProduct.price) : 0,
      quantity: quickProduct.quantity.trim() ? Number(quickProduct.quantity) : 0,
      volumeMl: isCupCategory(quickProduct.category) && quickProduct.volumeMl.trim()
        ? Number(quickProduct.volumeMl)
        : null,
      imageUrls: quickProductImages,
      showInShop: quickProduct.cafeOnly || quickProductIsDraft ? false : quickProduct.showInShop,
      featured: quickProductIsDraft ? false : quickProduct.featured,
    }

    try {
      const res = await fetch(`/api/pos/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Could not update product")
        return
      }

      setProducts((current) => current.map((product) => product.id === data.id ? data : product))
      setCart((current) => current.map((item) => item.product.id === data.id ? { ...item, product: data } : item))
      setSuccess(`${data.name} was updated.`)
      setIsQuickEditOpen(false)
      setEditingProduct(null)
      setQuickProduct(quickProductDefaults)
    } catch (productError) {
      console.error("Quick POS product edit failed", productError)
      setError("Could not update product.")
    } finally {
      setSavingProduct(false)
    }
  }

  const handleQuickImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setImageUploadNotice("")
    setImageUploadError("")

    try {
      const uploadForm = new FormData()
      uploadForm.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: uploadForm })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        console.error("POS product image upload failed details", { status: res.status, response: data })
        throw new Error(data.error || "Upload failed")
      }

      setQuickProduct((current) => ({
        ...current,
        imageUrls: [current.imageUrls, data.url].filter(Boolean).join("\n"),
      }))
      setImageUploadNotice("Image uploaded and added below.")
    } catch (uploadError) {
      console.error("POS product image upload failed", uploadError)
      setImageUploadError("That image could not be uploaded. Try a smaller JPG, PNG, or WebP.")
    } finally {
      setUploadingImage(false)
      event.target.value = ""
    }
  }

  const addToCart = (product: PosProduct) => {
    setSuccess("")
    setError("")
    if (product.status !== "AVAILABLE" || product.price <= 0) {
      setError(`${product.name} needs a price and Available status before checkout.`)
      return
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) return current
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...current, { product, quantity: 1, taxRate: 0, discountType: "NONE", discountValue: "" }]
    })
    setActiveCategory("ALL")
    setSearchTerm("")
    setPosStep("CATEGORIES")
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

  const updateCartItem = (productId: string, updates: Partial<Omit<CartItem, "product">>) => {
    setCart((current) => current.map((item) => (
      item.product.id === productId ? { ...item, ...updates } : item
    )))
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
      taxRate: item.taxRate,
      discountType: item.discountType,
      discountValue: Number(item.discountValue || 0),
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem("backus-pos-fullscreen", "1")
      window.dispatchEvent(new CustomEvent("backus-pos-kiosk-change", { detail: { enabled: true } }))
    }
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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("backus-pos-fullscreen")
        window.dispatchEvent(new CustomEvent("backus-pos-kiosk-change", { detail: { enabled: false } }))
      }
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

  const renderQuickProductFields = (prefix: string) => (
    <div className="grid gap-4 py-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}Name`}>Product name</Label>
        <Input
          id={`${prefix}Name`}
          value={quickProduct.name}
          onChange={(event) => updateQuickProduct("name", event.target.value)}
          placeholder="e.g., Blue cup, iced latte, incense holder"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}Sku`}>SKU or shelf code</Label>
        <Input
          id={`${prefix}Sku`}
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
        <Label>Status</Label>
        <Select value={quickProduct.status} onValueChange={(status) => updateQuickProduct("status", status)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POS_PRODUCT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {quickProductIsDraft && (
          <p className="text-xs text-muted-foreground">Drafts can be saved with only a name and finished later.</p>
        )}
      </div>

      {quickProductIsCup && (
        <div className="space-y-2">
          <Label htmlFor={`${prefix}VolumeMl`}>Volume (ml)</Label>
          <Input
            id={`${prefix}VolumeMl`}
            inputMode="numeric"
            value={quickProduct.volumeMl}
            onChange={(event) => updateQuickProduct("volumeMl", event.target.value)}
            placeholder="180"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${prefix}Price`}>Price (IDR){quickProductIsDraft && <span className="text-muted-foreground"> optional</span>}</Label>
        <Input
          id={`${prefix}Price`}
          inputMode="numeric"
          value={quickProduct.price}
          onChange={(event) => updateQuickProduct("price", event.target.value)}
          placeholder="250000"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}Quantity`}>Quantity{quickProductIsDraft && <span className="text-muted-foreground"> optional</span>}</Label>
        <Input
          id={`${prefix}Quantity`}
          inputMode="numeric"
          value={quickProduct.quantity}
          onChange={(event) => updateQuickProduct("quantity", event.target.value)}
          placeholder={quickProductIsDraft ? "Add later" : "1"}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}Description`}>Description</Label>
        <Textarea
          id={`${prefix}Description`}
          value={quickProduct.description}
          onChange={(event) => updateQuickProduct("description", event.target.value)}
          rows={3}
          placeholder="Optional details for the wares page or staff notes"
        />
      </div>

      <div className="space-y-3 sm:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label htmlFor={`${prefix}ImageUrls`}>Images</Label>
            <p className="text-xs text-muted-foreground">Upload or paste one image URL per line. The first image is the thumbnail.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploadingImage ? "Uploading..." : "Upload image"}
            <input type="file" accept="image/*" className="hidden" onChange={handleQuickImageUpload} disabled={uploadingImage} />
          </label>
        </div>
        <Textarea
          id={`${prefix}ImageUrls`}
          value={quickProduct.imageUrls}
          onChange={(event) => {
            updateQuickProduct("imageUrls", event.target.value)
            setImageUploadNotice("")
            setImageUploadError("")
          }}
          rows={3}
          placeholder="/uploads/cup.jpg or https://..."
        />
        {imageUploadNotice && (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {imageUploadNotice}
          </p>
        )}
        {imageUploadError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {imageUploadError}
          </p>
        )}
        {quickProductImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {quickProductImages.map((image) => (
              <div key={image} className="overflow-hidden rounded-md border border-border bg-muted">
                <img src={image} alt="" className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label htmlFor={`${prefix}CafeOnly`}>Cafe only</Label>
          <p className="text-xs text-muted-foreground">F&B and cashier-only items.</p>
        </div>
        <Switch
          id={`${prefix}CafeOnly`}
          checked={quickProduct.cafeOnly}
          onCheckedChange={(checked) => updateQuickProduct("cafeOnly", checked)}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label htmlFor={`${prefix}ShowInShop`}>Show on wares page</Label>
          <p className="text-xs text-muted-foreground">Keep off for cafe-only products.</p>
        </div>
        <Switch
          id={`${prefix}ShowInShop`}
          checked={quickProduct.showInShop && !quickProduct.cafeOnly && !quickProductIsDraft}
          disabled={quickProduct.cafeOnly || quickProductIsDraft}
          onCheckedChange={(checked) => updateQuickProduct("showInShop", checked)}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-3 sm:col-span-2">
        <div>
          <Label htmlFor={`${prefix}Featured`}>Featured</Label>
          <p className="text-xs text-muted-foreground">Place this piece near the top of the wares page.</p>
        </div>
        <Switch
          id={`${prefix}Featured`}
          checked={quickProduct.featured && !quickProductIsDraft}
          disabled={quickProductIsDraft}
          onCheckedChange={(checked) => updateQuickProduct("featured", checked)}
        />
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-3 sm:col-span-2">
        <div className="flex items-start gap-3">
          <ShoppingBag className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Available products can be checked out immediately. Drafts are visible for setup but disabled until finished.
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div
      ref={posRootRef}
      className={cn(
        "space-y-4",
        isFullscreen && "fixed inset-0 z-[80] h-[100dvh] overflow-auto overscroll-none bg-muted/30 p-2 sm:p-3 lg:p-4"
      )}
    >
      <div className="sticky top-0 z-40 -mx-2 flex flex-col gap-3 border-b border-border bg-muted/95 px-2 py-3 backdrop-blur sm:-mx-3 sm:px-3 lg:-mx-4 lg:flex-row lg:items-center lg:justify-between lg:px-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Point of Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {availableProducts.length} ready to sell · {draftProducts.length} need setup
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {cartCount > 0 && (
            <Button type="button" className="h-auto min-h-11 sm:min-w-36" onClick={() => setPosStep("CHECKOUT")}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Checkout · {formatPrice(cartSummary.total)}
            </Button>
          )}
          <Button type="button" variant="outline" className="h-auto min-h-11 sm:min-w-32" onClick={openQuickAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add product
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-12 sm:min-w-36">
            <Link href={`/admin/products${isFullscreen ? "?posFullscreen=1" : ""}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit products
            </Link>
          </Button>
          <Button
            type="button"
            variant={isFullscreen ? "secondary" : "outline"}
            className="h-auto min-h-11 sm:min-w-40"
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

      <div className="grid gap-3">
        <Card className={cn(posStep === "CHECKOUT" && "hidden")}>
          <CardContent className="p-4">
            {(posStep !== "CATEGORIES" || cartCount > 0) && (
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {activeCategory !== "ALL" && posStep === "ITEMS" && (
                  <span className="inline-flex min-h-10 items-center rounded-md bg-muted px-4 text-sm font-medium text-foreground">
                    {getProductCategoryLabel(activeCategory)}
                  </span>
                )}
                {cartCount > 0 && (
                  <Button type="button" variant="outline" onClick={() => setPosStep("CHECKOUT")}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Checkout ({cartCount})
                  </Button>
                )}
              </div>
              {posStep === "ITEMS" && (
              <div className="relative lg:w-96">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    const value = event.target.value
                    setSearchTerm(value)
                  }}
                  placeholder={`Search ${getProductCategoryLabel(activeCategory)}...`}
                  className="pl-9"
                />
              </div>
              )}
            </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : posStep === "CATEGORIES" && !searchTerm.trim() ? (
              <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {POS_PRODUCT_CATEGORIES.map((category) => {
                  const count = categoryCounts[category.id] || 0
                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={count === 0}
                      onClick={() => {
                        setActiveCategory(category.id)
                        setPosStep("ITEMS")
                      }}
                      className={cn(
                        "flex min-h-32 flex-col justify-between rounded-md border border-border bg-background p-5 text-left transition hover:border-primary hover:shadow-sm",
                        count === 0 && "cursor-not-allowed opacity-45 hover:border-border hover:shadow-none"
                      )}
                    >
                      <span className="font-heading text-2xl font-semibold text-foreground">{category.label}</span>
                      <span className="text-sm text-muted-foreground">{count} sellable item{count === 1 ? "" : "s"}</span>
                    </button>
                  )
                })}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-24 text-center">
                <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-foreground">No sellable products here</p>
                <p className="mt-1 text-sm text-muted-foreground">Only available products with prices appear on the POS.</p>
                <Button type="button" className="mt-5" onClick={openQuickAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add product
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActiveCategory("ALL")
                      setSearchTerm("")
                      setPosStep("CATEGORIES")
                    }}
                  >
                    Back to categories
                  </Button>
                  <p className="text-sm text-muted-foreground">{filteredProducts.length} item{filteredProducts.length === 1 ? "" : "s"}</p>
                </div>
                <div
                  className={cn(
                    "grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
                    isFullscreen ? "lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" : "2xl:grid-cols-6"
                  )}
                >
                  {filteredProducts.map((product) => {
                    const image = firstImage(product)
                    const inCart = cart.find((item) => item.product.id === product.id)?.quantity || 0
                    const volume = cupVolumeLabel(product)

                    return (
                      <div
                        key={product.id}
                        className="group relative overflow-hidden rounded-md border border-border bg-muted text-left shadow-sm transition hover:border-primary hover:shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="block w-full text-left"
                        >
                          <div className="relative aspect-square overflow-hidden">
                            {image ? (
                              <img src={image} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted">
                                <ShoppingCart className="h-7 w-7 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 min-h-[7rem] bg-gradient-to-t from-black/90 via-black/65 to-transparent p-3 pt-12 text-white">
                              <div className="flex items-end justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="line-clamp-2 text-sm font-semibold leading-tight">{product.name}</p>
                                  <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-white/75">
                                    {product.sku || getProductCategoryLabel(product.category)}
                                    {volume && <span> · {volume}</span>}
                                  </p>
                                </div>
                                {product.cafeOnly && <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white">Cafe</span>}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">{formatPrice(product.price)}</p>
                                <p className="text-[11px] text-white/75">{product.quantity - inCart} left</p>
                              </div>
                            </div>
                          </div>
                        </button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-2 z-10 h-8 w-8 bg-background/85 text-foreground shadow-sm hover:bg-background"
                          onClick={() => openQuickEdit(product)}
                          aria-label={`Quick edit ${product.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(posStep !== "CHECKOUT" && "hidden")}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                <ShoppingCart className="h-5 w-5" />
                Checkout
                <Badge variant="secondary">{cartCount} items</Badge>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveCategory("ALL")
                  setSearchTerm("")
                  setPosStep("CATEGORIES")
                }}
              >
                Back to categories
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            {cart.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-20 text-center xl:col-span-2">
                <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Tap products to add them here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const totals = cartLineTotals(item)
                  const suggestedTaxRate = defaultTaxRate(item.product)

                  return (
                  <div key={item.product.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">{formatPrice(item.product.price)} each</p>
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
                      <p className="font-semibold text-foreground">{formatPrice(totals.total)}</p>
                    </div>

                    <div className="mt-4 space-y-3 rounded-md bg-muted/35 p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax</Label>
                          <span className="text-[11px] text-muted-foreground">Suggested: {suggestedTaxRate}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[0, 10, 15].map((rate) => (
                            <Button
                              key={rate}
                              type="button"
                              size="sm"
                              variant={item.taxRate === rate ? "default" : "outline"}
                              className="h-9 px-2 text-xs"
                              onClick={() => updateCartItem(item.product.id, { taxRate: normalizePosTaxRate(rate) })}
                            >
                              {rate === 0 ? "No tax" : `${rate}%`}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discount</Label>
                          <Select
                            value={item.discountType}
                            onValueChange={(value) => {
                              const discountType = normalizePosDiscountType(value)
                              updateCartItem(item.product.id, {
                                discountType,
                                discountValue: discountType === "NONE" ? "" : item.discountValue,
                              })
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">None</SelectItem>
                              <SelectItem value="PERCENT">Percent</SelectItem>
                              <SelectItem value="AMOUNT">Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {item.discountType !== "NONE" && (
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {item.discountType === "PERCENT" ? "Percent off" : "Amount off"}
                            </Label>
                            <Input
                              className="h-9"
                              inputMode="numeric"
                              value={item.discountValue}
                              onChange={(event) => updateCartItem(item.product.id, { discountValue: event.target.value })}
                              placeholder={item.discountType === "PERCENT" ? "10" : "50000"}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Line subtotal</span>
                          <span>{formatPrice(totals.subtotal)}</span>
                        </div>
                        {totals.discountAmount > 0 && (
                          <div className="flex items-center justify-between">
                            <span>Discount</span>
                            <span>-{formatPrice(totals.discountAmount)}</span>
                          </div>
                        )}
                        {totals.taxAmount > 0 && (
                          <div className="flex items-center justify-between">
                            <span>Tax ({totals.taxRate}%)</span>
                            <span>{formatPrice(totals.taxAmount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            {cart.length > 0 && (
            <div className="space-y-5 rounded-md border border-border bg-background p-4 shadow-sm">
            <div className="rounded-md bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(cartSummary.subtotal)}</span>
              </div>
              {cartSummary.discountTotal > 0 && (
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Discounts</span>
                  <span>-{formatPrice(cartSummary.discountTotal)}</span>
                </div>
              )}
              {cartSummary.taxTotal > 0 && (
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatPrice(cartSummary.taxTotal)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xl font-bold text-foreground">
                <span>Total</span>
                <span>{formatPrice(cartSummary.total)}</span>
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
                <Label>Payment method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {POS_PAYMENT_OPTIONS.map((method) => (
                    <Button
                      key={method.value}
                      type="button"
                      variant={paymentMethod === method.value ? "default" : "outline"}
                      className="justify-center"
                      onClick={() => setPaymentMethod(method.value)}
                    >
                      {method.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                className="h-14 w-full text-base"
                onClick={handleMachinePaid}
                disabled={cart.length === 0 || checkingOut || onlineLoading}
              >
                {checkingOut ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                {paymentCompletionLabel(paymentMethod)}
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
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto md:max-w-3xl xl:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Add product to POS</DialogTitle>
            <DialogDescription>
              Use this for quick cashier inventory. Detailed photos and long descriptions can still be edited later in Products.
            </DialogDescription>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogHeader>

          {renderQuickProductFields("quick")}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddProduct} disabled={savingProduct}>
              {savingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {quickProductIsDraft ? "Save draft" : "Add to POS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickEditOpen} onOpenChange={setIsQuickEditOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto md:max-w-3xl xl:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Quick edit product</DialogTitle>
            <DialogDescription>
              Update price, stock, sales channel, and images without leaving the POS.
            </DialogDescription>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogHeader>

          {renderQuickProductFields("quickEdit")}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickEditProduct} disabled={savingProduct || !editingProduct}>
              {savingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
