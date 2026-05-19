"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/shop-data"
import { cn } from "@/lib/utils"
import { Loader2, Plus, Store } from "lucide-react"

interface PosProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  description: string | null
  price: number
  currency: string
  category: string
  quantity: number
  status: string
  showInShop: boolean
  createdAt: string
}

const categories = ["Cups", "Bowls", "Sets", "Coffee Gear", "Tea Ware", "Vases", "Platters", "Studio pieces"]
const statuses = ["AVAILABLE", "DRAFT", "SOLD", "ARCHIVED"]

export default function AdminPosPage() {
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "Studio pieces",
    price: "",
    quantity: "1",
    status: "AVAILABLE",
    description: "",
    showInShop: false,
  })

  const availableCount = useMemo(
    () => products.filter((product) => product.status === "AVAILABLE").length,
    [products]
  )

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/pos/products")
      if (res.ok) {
        setProducts(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category: "Studio pieces",
      price: "",
      quantity: "1",
      status: "AVAILABLE",
      description: "",
      showInShop: false,
    })
  }

  const handleSave = async () => {
    setError("")
    setSaving(true)

    try {
      const res = await fetch("/api/pos/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not add product")
        return
      }

      setProducts((prev) => [data, ...prev])
      resetForm()
    } catch {
      setError("Could not add product")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Point of Sale</h1>
          <p className="mt-1 text-muted-foreground">
            Add studio pieces as sellable inventory for the shop system.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Total items</p>
            <p className="text-2xl font-semibold text-foreground">{products.length}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-semibold text-foreground">{availableCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <Plus className="h-5 w-5" />
              Add product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Product name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="e.g., Speckled vase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Price (IDR)</Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  value={formData.price}
                  onChange={(event) => setFormData({ ...formData, price: event.target.value })}
                  placeholder="450000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  inputMode="numeric"
                  value={formData.quantity}
                  onChange={(event) => setFormData({ ...formData, quantity: event.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(category) => setFormData({ ...formData, category })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(status) => setFormData({ ...formData, status })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU or shelf code</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(event) => setFormData({ ...formData, sku: event.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Clay body, glaze, size, or notes"
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="showInShop">Eligible for shop</Label>
                <p className="text-xs text-muted-foreground">Mark pieces that may be surfaced online later.</p>
              </div>
              <Switch
                id="showInShop"
                checked={formData.showInShop}
                onCheckedChange={(showInShop) => setFormData({ ...formData, showInShop })}
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
              Add to POS
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">POS inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="py-16 text-center">
                <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-foreground">No POS products yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add the first piece from the form.</p>
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
                      <TableHead>Shop</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.sku || product.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
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
                        <TableCell>{product.showInShop ? "Eligible" : "POS only"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
