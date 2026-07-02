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
  normalizeProductCategory,
  parseProductImageUrls,
  POS_PRODUCT_CATEGORIES,
  POS_PRODUCT_STATUSES,
} from "@/lib/pos-catalog"
import { cn } from "@/lib/utils"
import {
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react"
import Link from "next/link"

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

interface ProductFormState {
  name: string
  sku: string
  category: string
  price: string
  quantity: string
  status: string
  description: string
  imageUrls: string
  cafeOnly: boolean
  showInShop: boolean
  featured: boolean
  sortOrder: string
}

const emptyForm: ProductFormState = {
  name: "",
  sku: "",
  category: "CUPS",
  price: "",
  quantity: "1",
  status: "AVAILABLE",
  description: "",
  imageUrls: "",
  cafeOnly: false,
  showInShop: true,
  featured: false,
  sortOrder: "0",
}

function toImageText(value: string | null) {
  return parseProductImageUrls(value).join("\n")
}

function firstImage(product: PosProduct) {
  return parseProductImageUrls(product.imageUrls)[0] || ""
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("ALL")
  const [editingProduct, setEditingProduct] = useState<PosProduct | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ProductFormState>(emptyForm)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const search = searchTerm.trim().toLowerCase()
      const matchesSearch = !search || [
        product.name,
        product.sku || "",
        product.description || "",
      ].some((value) => value.toLowerCase().includes(search))
      const matchesCategory = filterCategory === "ALL" || normalizeProductCategory(product.category) === filterCategory
      return matchesSearch && matchesCategory
    })
  }, [filterCategory, products, searchTerm])

  const shopCount = useMemo(
    () => products.filter((product) => product.showInShop && !product.cafeOnly && product.status === "AVAILABLE").length,
    [products]
  )

  useEffect(() => {
    fetchProducts()
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
    setError("")
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
      imageUrls: toImageText(product.imageUrls),
      cafeOnly: product.cafeOnly,
      showInShop: product.showInShop,
      featured: product.featured,
      sortOrder: product.sortOrder.toString(),
    })
    setError("")
    setIsDialogOpen(true)
  }

  const handleFormChange = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setFormData((current) => {
      if (key === "cafeOnly" && value === true) {
        return { ...current, cafeOnly: true, showInShop: false }
      }
      return { ...current, [key]: value }
    })
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError("")

    try {
      const uploadForm = new FormData()
      uploadForm.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: uploadForm })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed")

      setFormData((current) => ({
        ...current,
        imageUrls: [current.imageUrls, data.url].filter(Boolean).join("\n"),
      }))
    } catch (uploadError) {
      console.error("Product image upload failed", uploadError)
      setError("Could not upload that image.")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")

    const payload = {
      ...formData,
      price: Number(formData.price),
      quantity: Number(formData.quantity),
      sortOrder: Number(formData.sortOrder || 0),
      imageUrls: parseProductImageUrls(formData.imageUrls),
      showInShop: formData.cafeOnly ? false : formData.showInShop,
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
    } catch (archiveError) {
      console.error("Product archive failed", archiveError)
      setError("Could not archive product.")
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-muted-foreground">
            Manage POS inventory and the hidden ceramic wares sales page.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/admin/wares">
              <Eye className="mr-2 h-4 w-4" />
              Preview wares page
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Catalog items</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{products.length}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Visible on wares page</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{shopCount}</p>
        </div>
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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products, SKU, or notes..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-56">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Catalog ({filteredProducts.length})</CardTitle>
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
            <div className="overflow-x-auto">
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
                              <p className="text-xs text-muted-foreground">{product.sku || product.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getProductCategoryLabel(product.category)}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>{formatPrice(product.price)}</TableCell>
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
                              <Badge variant="secondary">Wares page</Badge>
                            )}
                            {product.featured && <Badge variant="outline">Featured</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                              <Pencil className="h-4 w-4" />
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              {editingProduct ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription>
              Products marked for the wares page appear in the admin-only sales preview. Cafe-only items stay on the POS.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
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
              <Label htmlFor="price">Price (IDR)</Label>
              <Input
                id="price"
                inputMode="numeric"
                value={formData.price}
                onChange={(event) => handleFormChange("price", event.target.value)}
                placeholder="450000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                inputMode="numeric"
                value={formData.quantity}
                onChange={(event) => handleFormChange("quantity", event.target.value)}
              />
            </div>

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
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                inputMode="numeric"
                value={formData.sortOrder}
                onChange={(event) => handleFormChange("sortOrder", event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => handleFormChange("description", event.target.value)}
                rows={4}
                placeholder="Clay body, glaze, dimensions, use notes, or origin story"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="imageUrls">Images</Label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Upload image
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
              <Textarea
                id="imageUrls"
                value={formData.imageUrls}
                onChange={(event) => handleFormChange("imageUrls", event.target.value)}
                rows={3}
                placeholder="/uploads/cup.jpg or https://..."
              />
              <p className="text-xs text-muted-foreground">Add one image URL per line. The first image is used as the main thumbnail.</p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
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

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="showInShop">Show on wares page</Label>
                <p className="text-xs text-muted-foreground">Disabled for cafe-only products.</p>
              </div>
              <Switch
                id="showInShop"
                checked={formData.showInShop && !formData.cafeOnly}
                disabled={formData.cafeOnly}
                onCheckedChange={(checked) => handleFormChange("showInShop", checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3 md:col-span-2">
              <div>
                <Label htmlFor="featured">Featured</Label>
                <p className="text-xs text-muted-foreground">Place this piece near the top of the wares page.</p>
              </div>
              <Switch
                id="featured"
                checked={formData.featured}
                onCheckedChange={(checked) => handleFormChange("featured", checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
