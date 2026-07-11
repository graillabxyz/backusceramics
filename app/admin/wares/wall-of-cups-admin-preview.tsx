"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { formatPrice, parseProductImageUrls } from "@/lib/pos-catalog"
import { cn } from "@/lib/utils"

export interface WallOfCupsProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  description: string | null
  volumeMl: number | null
  imageUrls: string | null
  price: number
  category: string
  quantity: number
  status: string
  showInShop: boolean
  featured: boolean
}

interface WallOfCupsAdminPreviewProps {
  initialProducts: WallOfCupsProduct[]
}

function firstImage(product: WallOfCupsProduct) {
  return parseProductImageUrls(product.imageUrls)[0] || ""
}

function canPublish(product: WallOfCupsProduct) {
  return product.status === "AVAILABLE" && product.quantity > 0 && product.price > 0
}

function normalizeProduct(data: Partial<WallOfCupsProduct>, fallback: WallOfCupsProduct): WallOfCupsProduct {
  return {
    ...fallback,
    id: String(data.id || fallback.id),
    name: String(data.name || fallback.name),
    slug: String(data.slug || fallback.slug),
    sku: data.sku ?? fallback.sku,
    description: data.description ?? fallback.description,
    volumeMl: typeof data.volumeMl === "number" ? data.volumeMl : fallback.volumeMl,
    imageUrls: data.imageUrls ?? fallback.imageUrls,
    price: typeof data.price === "number" ? data.price : fallback.price,
    category: String(data.category || fallback.category),
    quantity: typeof data.quantity === "number" ? data.quantity : fallback.quantity,
    status: String(data.status || fallback.status),
    showInShop: typeof data.showInShop === "boolean" ? data.showInShop : fallback.showInShop,
    featured: typeof data.featured === "boolean" ? data.featured : fallback.featured,
  }
}

export function WallOfCupsAdminPreview({ initialProducts }: WallOfCupsAdminPreviewProps) {
  const [products, setProducts] = useState(initialProducts)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const publishedCount = useMemo(() => products.filter((product) => product.showInShop).length, [products])

  const updatePublished = async (product: WallOfCupsProduct, nextPublished: boolean) => {
    if (nextPublished && !canPublish(product)) return

    const previousProducts = products
    setSavingId(product.id)
    setError("")
    setSuccess("")
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, showInShop: nextPublished } : item))
    )

    try {
      const res = await fetch(`/api/pos/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showInShop: nextPublished }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update visibility")

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? normalizeProduct(data, item) : item))
      )
      setSuccess(`${product.name} is ${nextPublished ? "visible" : "hidden"} on the public Wall of Cups.`)
    } catch (visibilityError) {
      console.error("Wall of Cups visibility update failed", visibilityError)
      setProducts(previousProducts)
      setError("Could not update that cup. Check that it has a price, stock, and Available status.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Admin preview</p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Wall of Cups
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Each cup is a small work of art that still belongs to daily life: held, used, noticed,
            and quietly returned to ritual.
          </p>
          <p className="mt-5 font-heading text-xl leading-relaxed text-foreground">
            clay remembers touch<br />
            ceremony in a cup<br />
            today is my day
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/products">Manage products</Link>
          </Button>
          <Button asChild>
            <Link href="/wall-of-cups" target="_blank" rel="noopener noreferrer">
              View public page
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <p className="text-sm text-muted-foreground">
          {publishedCount} of {products.length} cups displayed online.
        </p>
        <p className="text-sm text-muted-foreground">
          Check "Display online" only when the cup is priced, stocked, photographed, and ready.
        </p>
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

      {products.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-medium text-foreground">No cups have been added yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Create cup products first, then return here to publish them.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {products.map((product) => {
            const image = firstImage(product)
            const isSaving = savingId === product.id
            const publishable = canPublish(product)

            return (
              <article
                key={product.id}
                className={cn(
                  "group relative overflow-hidden rounded-sm bg-muted shadow-sm",
                  !product.showInShop && "opacity-75"
                )}
              >
                <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-background/90 px-3 py-2 text-sm font-medium shadow-sm backdrop-blur">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Checkbox
                      checked={product.showInShop}
                      disabled={!publishable}
                      onCheckedChange={(checked) => updatePublished(product, checked === true)}
                      aria-label={`Display ${product.name} online`}
                    />
                  )}
                  <span>Display online</span>
                </div>

                {!publishable && (
                  <Badge variant="secondary" className="absolute right-3 top-3 z-10 bg-background/90 text-foreground">
                    Needs setup
                  </Badge>
                )}

                <div className="aspect-[3/4]">
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                      Add image
                    </div>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-16 text-white">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words font-heading text-xl font-bold leading-tight">{product.name}</h2>
                      <p className="mt-1 text-sm text-white/75">
                        {product.volumeMl ? `${product.volumeMl} ml · ` : ""}
                        {product.quantity} available
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{formatPrice(product.price)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/70">
                    <span>{product.showInShop ? "Public" : "Hidden"}</span>
                    <Link href={`/admin/products?edit=${product.id}`} className="hover:text-white">
                      Edit
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
