"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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
  ArrowLeft,
  CheckCircle2,
  Eye,
  ImagePlus,
  Loader2,
  Minimize2,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react"
import Link from "next/link"

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

interface ProductFormState {
  name: string
  sku: string
  category: string
  price: string
  quantity: string
  status: string
  description: string
  volumeMl: string
  imageUrls: string
  cafeOnly: boolean
  showInShop: boolean
  featured: boolean
}

const emptyForm: ProductFormState = {
  name: "",
  sku: "",
  category: "CUPS",
  price: "",
  quantity: "",
  status: "DRAFT",
  description: "",
  volumeMl: "",
  imageUrls: "",
  cafeOnly: false,
  showInShop: false,
  featured: false,
}

function toImageText(value: string | null) {
  return parseProductImageUrls(value).join("\n")
}

function firstImage(product: PosProduct) {
  return parseProductImageUrls(product.imageUrls)[0] || ""
}

function cupVolumeLabel(product: PosProduct) {
  return isCupCategory(product.category) && product.volumeMl ? `${product.volumeMl} ml` : ""
}

function productPriceLabel(product: PosProduct) {
  return product.status === "DRAFT" && product.price === 0 ? "No price yet" : formatPrice(product.price)
}

function productQuantityLabel(product: PosProduct) {
  return product.status === "DRAFT" && product.quantity === 0 ? "No stock set" : `${product.quantity} in stock`
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [imageUploadNotice, setImageUploadNotice] = useState("")
  const [imageUploadError, setImageUploadError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [editingProduct, setEditingProduct] = useState<PosProduct | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ProductFormState>(emptyForm)
  const [isPosFullscreen, setIsPosFullscreen] = useState(false)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const search = searchTerm.trim().toLowerCase()
      const matchesSearch = !search || [
        product.name,
        product.sku || "",
        product.description || "",
      ].some((value) => value.toLowerCase().includes(search))
      const matchesCategory = filterCategory === "ALL" || normalizeProductCategory(product.category) === filterCategory
      const matchesStatus = filterStatus === "ALL" || product.status === filterStatus
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [filterCategory, filterStatus, products, searchTerm])

  const shopCount = useMemo(
    () => products.filter((product) => product.showInShop && !product.cafeOnly && product.status === "AVAILABLE" && isCupCategory(product.category)).length,
    [products]
  )
  const draftCount = useMemo(
    () => products.filter((product) => product.status === "DRAFT").length,
    [products]
  )
  const setupCount = useMemo(
    () => products.filter((product) => product.status === "DRAFT" || product.price <= 0).length,
    [products]
  )
  const formImages = useMemo(() => parseProductImageUrls(formData.imageUrls), [formData.imageUrls])
  const formIsCup = isCupCategory(formData.category)
  const formIsDraft = formData.status === "DRAFT"

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    if (params.get("posFullscreen") === "1" || window.localStorage.getItem("backus-pos-fullscreen") === "1") {
      window.localStorage.setItem("backus-pos-fullscreen", "1")
      setIsPosFullscreen(true)
      window.dispatchEvent(new CustomEvent("backus-pos-kiosk-change", { detail: { enabled: true } }))
    }
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pos/products")
      if (!res.ok) throw new Error("Could not load products")
      setProducts(await res.json())
    } catch (loadError) {
      console.error("Product catalog load failed", loadError)
      setError("Could not load products.")
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingProduct(null)
    setFormData(emptyForm)
    setImageUploadNotice("")
    setImageUploadError("")
    setError("")
    setSuccess("")
    setIsDialogOpen(true)
  }

  const openEdit = (product: PosProduct) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku || "",
      category: normalizeProductCategory(product.category),
      price: product.price.toString(),
      quantity: product.quantity.toString(),
      status: product.status,
      description: product.description || "",
      volumeMl: product.volumeMl ? product.volumeMl.toString() : "",
      imageUrls: toImageText(product.imageUrls),
      cafeOnly: product.cafeOnly,
      showInShop: product.showInShop,
      featured: product.featured,
    })
    setImageUploadNotice("")
    setImageUploadError("")
    setError("")
    setSuccess("")
    setIsDialogOpen(true)
  }

  useEffect(() => {
    if (loading || products.length === 0 || typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const editId = params.get("edit")
    if (!editId) return

    const product = products.find((item) => item.id === editId)
    if (!product) return

    openEdit(product)
    params.delete("edit")
    const nextSearch = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`)
  }, [loading, products])

  const handleFormChange = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setFormData((current) => {
      if (key === "cafeOnly" && value === true) {
        return { ...current, cafeOnly: true, showInShop: false }
      }
      if (key === "status" && value === "DRAFT") {
        return { ...current, status: "DRAFT", showInShop: false, featured: false }
      }
      if (key === "category") {
        const category = String(value)
        if (!isCupCategory(category)) {
          return { ...current, category, volumeMl: "" }
        }
        return { ...current, category }
      }
      return { ...current, [key]: value }
    })
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setImageUploadNotice("")
    setImageUploadError("")

    try {
      const uploadForm = new FormData()
      uploadForm.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: uploadForm })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        console.error("Product image upload failed details", { status: res.status, response: data })
        throw new Error(data.error || "Upload failed")
      }

      setFormData((current) => ({
        ...current,
        imageUrls: [current.imageUrls, data.url].filter(Boolean).join("\n"),
      }))
      setImageUploadNotice("Image uploaded and previewed below.")
    } catch (uploadError) {
      console.error("Product image upload failed", uploadError)
      setImageUploadError("That image could not be uploaded. Try a smaller JPG, PNG, WebP, HEIC, or HEIF.")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  const exitPosFullscreen = () => {
    if (typeof window === "undefined") return

    window.localStorage.removeItem("backus-pos-fullscreen")
    window.dispatchEvent(new CustomEvent("backus-pos-kiosk-change", { detail: { enabled: false } }))
    setIsPosFullscreen(false)

    const params = new URLSearchParams(window.location.search)
    params.delete("posFullscreen")
    const nextSearch = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`)
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSuccess("")

    const payload = {
      ...formData,
      price: formData.price.trim() ? Number(formData.price) : null,
      quantity: formData.quantity.trim() ? Number(formData.quantity) : null,
      volumeMl: isCupCategory(formData.category) && formData.volumeMl.trim()
        ? Number(formData.volumeMl)
        : null,
      imageUrls: parseProductImageUrls(formData.imageUrls),
      showInShop: formData.cafeOnly || formIsDraft || !formIsCup ? false : formData.showInShop,
      featured: formIsDraft ? false : formData.featured,
    }

    try {
      const res = await fetch(editingProduct ? `/api/pos/products/${editingProduct.id}` : "/api/pos/products", {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Could not save product")
        return
      }

      setProducts((current) => {
        if (editingProduct) return current.map((product) => product.id === data.id ? data : product)
        return [data, ...current]
      })
      setSuccess(`${data.name} was saved.`)
      setIsDialogOpen(false)
    } catch (saveError) {
      console.error("Product save failed", saveError)
      setError("Could not save product.")
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (product: PosProduct) => {
    if (!confirm(`Archive ${product.name}?`)) return

    try {
      const res = await fetch(`/api/pos/products/${product.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Archive failed")
      setProducts((current) => current.map((item) => item.id === product.id ? data : item))
      setSuccess(`${product.name} was archived.`)
    } catch (archiveError) {
      console.error("Product archive failed", archiveError)
      setError("Could not archive product.")
    }
  }

  return (
    <div className={cn("space-y-8", isPosFullscreen && "space-y-4")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-muted-foreground">
            Manage POS inventory and the public Wall of Cups.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {isPosFullscreen && (
            <>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/admin/pos?posFullscreen=1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to POS
                </Link>
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={exitPosFullscreen}>
                <Minimize2 className="mr-2 h-4 w-4" />
                Exit fullscreen
              </Button>
            </>
          )}
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`/admin/wares${isPosFullscreen ? "?posFullscreen=1" : ""}`}>
              <Eye className="mr-2 h-4 w-4" />
              Preview Wall of Cups
            </Link>
          </Button>
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          className={cn(
            "rounded-md border border-border bg-background p-4 text-left transition hover:border-primary",
            filterStatus === "ALL" && "border-primary"
          )}
          onClick={() => setFilterStatus("ALL")}
        >
          <p className="text-sm text-muted-foreground">Catalog items</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{products.length}</p>
        </button>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Visible on Wall of Cups</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{shopCount}</p>
        </div>
        <button
          type="button"
          className={cn(
            "rounded-md border border-border bg-background p-4 text-left transition hover:border-primary",
            filterStatus === "DRAFT" && "border-primary"
          )}
          onClick={() => setFilterStatus("DRAFT")}
        >
          <p className="text-sm text-muted-foreground">Drafts</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{draftCount}</p>
        </button>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Cafe-only</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {products.filter((product) => product.cafeOnly).length}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products, SKU, or notes..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[42rem]">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {POS_PRODUCT_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {POS_PRODUCT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={filterStatus === "DRAFT" ? "default" : "outline"}
                onClick={() => setFilterStatus("DRAFT")}
              >
                Drafts ({draftCount})
              </Button>
            </div>
          </div>
          {setupCount > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {setupCount} products need setup before checkout. Use the Drafts filter to add prices, stock, and Available status.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">
            {filterStatus === "DRAFT" ? "Drafts" : "Catalog"} ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-medium text-foreground">No products found</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a piece or clear the current filters.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredProducts.map((product) => {
                  const image = firstImage(product)
                  const volume = cupVolumeLabel(product)

                  return (
                    <article key={product.id} className="rounded-md border border-border bg-background p-3 shadow-sm">
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          {image ? (
                            <img src={image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-foreground">{product.name}</h3>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {product.sku || product.slug}
                                {volume && <span> · {volume}</span>}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "shrink-0",
                                product.status === "AVAILABLE" && "bg-primary text-primary-foreground"
                              )}
                            >
                              {product.status.toLowerCase()}
                            </Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline">{getProductCategoryLabel(product.category)}</Badge>
                            <Badge variant={product.cafeOnly ? "default" : "outline"}>
                              {product.cafeOnly ? "Cafe only" : "POS"}
                            </Badge>
                            {product.showInShop && !product.cafeOnly && (
                              <Badge variant="secondary">Wall of Cups</Badge>
                            )}
                            {product.featured && <Badge variant="outline">Featured</Badge>}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{productPriceLabel(product)}</p>
                              <p className="text-xs text-muted-foreground">{productQuantityLabel(product)}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleArchive(product)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const image = firstImage(product)

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-md bg-muted">
                              {image ? (
                                <img src={image} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku || product.slug}
                                {cupVolumeLabel(product) && <span> · {cupVolumeLabel(product)}</span>}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getProductCategoryLabel(product.category)}</TableCell>
                        <TableCell>{product.status === "DRAFT" && product.quantity === 0 ? "Not set" : product.quantity}</TableCell>
                        <TableCell>{productPriceLabel(product)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(product.status === "AVAILABLE" && "bg-primary text-primary-foreground")}
                          >
                            {product.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={product.cafeOnly ? "default" : "outline"}>
                              {product.cafeOnly ? "Cafe only" : "POS"}
                            </Badge>
                            {product.showInShop && !product.cafeOnly && (
                              <Badge variant="secondary">Wall of Cups</Badge>
                            )}
                            {product.featured && <Badge variant="outline">Featured</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleArchive(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="grid max-h-[92vh] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:p-6 md:max-w-3xl xl:max-w-6xl">
          <DialogHeader className="border-b border-border px-4 py-4 text-left sm:border-0 sm:px-0 sm:py-0">
            <DialogTitle className="font-heading text-2xl">
              {editingProduct ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription>
              Drafts only need a name. Add price, stock, images, and sales channels when the piece is ready.
            </DialogDescription>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-0">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <section className="rounded-md border border-border bg-muted/20 p-4">
              <div className="mb-4">
                <h3 className="font-heading text-lg font-semibold text-foreground">Product details</h3>
                <p className="text-sm text-muted-foreground">
                  Name is required. Pricing and stock are required only before publishing as available.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Product name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) => handleFormChange("name", event.target.value)}
                    placeholder="e.g., Wall cup 24"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU or shelf code</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(event) => handleFormChange("sku", event.target.value)}
                    placeholder="CUP-WALL-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(category) => handleFormChange("category", category)}>
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
                  <Label htmlFor="price">Price (IDR){formIsDraft && <span className="text-muted-foreground"> optional</span>}</Label>
                  <Input
                    id="price"
                    inputMode="numeric"
                    value={formData.price}
                    onChange={(event) => handleFormChange("price", event.target.value)}
                    placeholder="450000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity{formIsDraft && <span className="text-muted-foreground"> optional</span>}</Label>
                  <Input
                    id="quantity"
                    inputMode="numeric"
                    value={formData.quantity}
                    onChange={(event) => handleFormChange("quantity", event.target.value)}
                    placeholder={formIsDraft ? "Add later" : "1"}
                  />
                </div>

                {formIsCup && (
                  <div className="space-y-2">
                    <Label htmlFor="volumeMl">Volume (ml)</Label>
                    <Input
                      id="volumeMl"
                      inputMode="numeric"
                      value={formData.volumeMl}
                      onChange={(event) => handleFormChange("volumeMl", event.target.value)}
                      placeholder="180"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(status) => handleFormChange("status", status)}>
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
                  {formIsDraft && (
                    <p className="text-xs text-muted-foreground">Draft products cannot be sold or shown on the Wall of Cups until marked available.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-md border border-border bg-muted/20 p-4">
              <div className="mb-4">
                <h3 className="font-heading text-lg font-semibold text-foreground">Story and images</h3>
                <p className="text-sm text-muted-foreground">Photos and notes that help sell the piece.</p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(event) => handleFormChange("description", event.target.value)}
                    rows={4}
                    placeholder="Clay body, glaze, dimensions, use notes, or origin story"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="imageUrls">Images</Label>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Upload image
                      <input type="file" accept="image/*,.heic,.heif,.avif" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </div>
                  <Textarea
                    id="imageUrls"
                    value={formData.imageUrls}
                    onChange={(event) => {
                      handleFormChange("imageUrls", event.target.value)
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
                  {formImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {formImages.map((image) => (
                        <div key={image} className="overflow-hidden rounded-md border border-border bg-muted">
                          <img src={image} alt="" className="aspect-square w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                      <Store className="h-4 w-4" />
                      Image previews will appear here after upload or URL entry.
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Add one image URL per line. The first image is used as the main thumbnail.</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-border bg-muted/20 p-4 xl:col-span-2">
              <div className="mb-4">
                <h3 className="font-heading text-lg font-semibold text-foreground">Sales channels</h3>
                <p className="text-sm text-muted-foreground">
                  Choose where this product should appear after it is marked available.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                  <div>
                    <Label htmlFor="cafeOnly">Cafe only</Label>
                    <p className="text-xs text-muted-foreground">Use for F&B or products sold only at the cashier.</p>
                  </div>
                  <Switch
                    id="cafeOnly"
                    checked={formData.cafeOnly}
                    onCheckedChange={(checked) => handleFormChange("cafeOnly", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                  <div>
                    <Label htmlFor="showInShop">Show on Wall of Cups</Label>
                    <p className="text-xs text-muted-foreground">Only available cup products can be displayed.</p>
                  </div>
                  <Switch
                    id="showInShop"
                    checked={formData.showInShop && !formData.cafeOnly && !formIsDraft && formIsCup}
                    disabled={formData.cafeOnly || formIsDraft || !formIsCup}
                    onCheckedChange={(checked) => handleFormChange("showInShop", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border bg-background p-3 md:col-span-2">
                  <div>
                    <Label htmlFor="featured">Featured</Label>
                    <p className="text-xs text-muted-foreground">Place this piece near the top of the Wall of Cups.</p>
                  </div>
                  <Switch
                    id="featured"
                    checked={formData.featured && !formIsDraft}
                    disabled={formIsDraft}
                    onCheckedChange={(checked) => handleFormChange("featured", checked)}
                  />
                </div>
              </div>
            </section>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-background px-4 py-3 sm:px-0 sm:pb-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formIsDraft ? "Save draft" : "Save product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
