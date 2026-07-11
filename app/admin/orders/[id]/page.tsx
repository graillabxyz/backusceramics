"use client"

import { useState, useEffect, useRef, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft, Loader2, Upload, Plus, Clock, User, MapPin, Mail, Phone, Package,
  FileText, Download, X,
} from "lucide-react"
import Link from "next/link"
import {
  formatAttachmentSize,
  parseOrderAttachments,
  parseOrderImageUrls,
  type OrderAttachment,
} from "@/lib/order-attachments"

interface OrderUpdate {
  id: string
  title: string
  description: string | null
  images: string | null
  attachments: string | null
  createdAt: string
}

interface OrderData {
  id: string
  status: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  contactLocation: string
  pieces: string
  preferences: string
  updates: OrderUpdate[]
  createdAt: string
  updatedAt: string
  user: { name: string | null; email: string } | null
}

const ALL_STATUSES = [
  "INQUIRY", "REVIEWING", "QUOTED", "ACCEPTED",
  "IN_PROGRESS", "GLAZING", "FIRING", "COMPLETED", "SHIPPED", "CANCELLED",
]

const statusLabels: Record<string, string> = {
  INQUIRY: "New Inquiry", REVIEWING: "Reviewing", QUOTED: "Quoted",
  ACCEPTED: "Accepted", IN_PROGRESS: "In Progress", GLAZING: "Glazing",
  FIRING: "Firing", COMPLETED: "Completed", SHIPPED: "Shipped", CANCELLED: "Cancelled",
}

const statusColors: Record<string, string> = {
  INQUIRY: "bg-blue-100 text-blue-800", REVIEWING: "bg-yellow-100 text-yellow-800",
  QUOTED: "bg-purple-100 text-purple-800", ACCEPTED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800", GLAZING: "bg-teal-100 text-teal-800",
  FIRING: "bg-red-100 text-red-800", COMPLETED: "bg-emerald-100 text-emerald-800",
  SHIPPED: "bg-indigo-100 text-indigo-800", CANCELLED: "bg-gray-100 text-gray-800",
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingUpdate, setAddingUpdate] = useState(false)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [updateTitle, setUpdateTitle] = useState("")
  const [updateDescription, setUpdateDescription] = useState("")
  const [updateFiles, setUpdateFiles] = useState<File[]>([])
  const [updateError, setUpdateError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchOrder()
  }, [id])

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`)
      if (res.ok) {
        setOrder(await res.json())
      } else {
        router.push("/admin/orders")
      }
    } catch {
      router.push("/admin/orders")
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setOrder((prev) => prev ? { ...prev, status: newStatus } : null)
      }
    } catch (err) {
      console.error("Failed to update status:", err)
    } finally {
      setSaving(false)
    }
  }

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updateTitle.trim()) return
    setAddingUpdate(true)
    setUpdateError("")

    try {
      const imageUrls: string[] = []
      const attachments: OrderAttachment[] = []
      for (const file of updateFiles) {
        const formData = new FormData()
        formData.append("file", file)
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        const endpoint = isPdf ? `/api/orders/${id}/attachments` : "/api/upload"
        const uploadRes = await fetch(endpoint, { method: "POST", body: formData })
        const uploadData = await uploadRes.json().catch(() => ({}))
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || `${file.name} could not be uploaded`)
        }
        if (isPdf) attachments.push(uploadData as OrderAttachment)
        else if (uploadData.url) imageUrls.push(uploadData.url)
      }

      const res = await fetch(`/api/orders/${id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updateTitle,
          description: updateDescription || null,
          images: imageUrls.length > 0 ? imageUrls : null,
          attachments: attachments.length > 0 ? attachments : null,
        }),
      })

      const responseData = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(responseData.error || "The update could not be posted")
      }

      await fetchOrder()
      setUpdateTitle("")
      setUpdateDescription("")
      setUpdateFiles([])
      setShowUpdateForm(false)
    } catch (err) {
      console.error("Failed to add update:", err)
      setUpdateError(err instanceof Error ? err.message : "The update could not be posted. Please try again.")
    } finally {
      setAddingUpdate(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!order) return null

  const pieces = JSON.parse(order.pieces) as Array<{
    pieceType: string; dimensions: string; quantity: string; finishing: string; imageCount?: number
  }>
  const preferences = JSON.parse(order.preferences) as Record<string, string>

  const importantPreferenceKeys = new Set(["inspiration", "additionalNotes"])

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Back button */}
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground">
            Order from {order.contactName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{order.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </div>
      </div>

      {/* Status Update */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Update Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <Button
                key={s}
                variant={order.status === s ? "default" : "outline"}
                size="sm"
                disabled={saving}
                onClick={() => updateStatus(s)}
                className="text-xs"
              >
                {statusLabels[s]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading font-bold text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{order.contactName}</p>
                {order.user && <p className="text-xs text-muted-foreground">Registered user</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${order.contactEmail}`} className="text-sm text-primary hover:underline">
                {order.contactEmail}
              </a>
            </div>
            {order.contactPhone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{order.contactPhone}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{order.contactLocation}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Submitted {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Order Pieces */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading font-bold text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items ({pieces.length} line items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pieces.map((piece, i) => (
              <div key={i} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <h4 className="font-medium text-foreground">Piece {i + 1}</h4>
                  <Badge variant="secondary">{piece.quantity}x</Badge>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                  <div><strong>Type:</strong> {piece.pieceType || "—"}</div>
                  <div><strong>Dimensions:</strong> {piece.dimensions || "—"}</div>
                  <div><strong>Finishing:</strong> {piece.finishing || "—"}</div>
                  {piece.imageCount !== undefined && (
                    <div><strong>Ref. Images:</strong> {piece.imageCount}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading font-bold text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(preferences).map(([key, value]) => (
              value ? (
                <div key={key} className={importantPreferenceKeys.has(key) ? "md:col-span-2" : ""}>
                  <p className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words font-medium text-foreground">{value}</p>
                </div>
              ) : null
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Updates Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-heading font-bold text-lg">Progress Updates</CardTitle>
            <CardDescription>Updates visible to the customer</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowUpdateForm(!showUpdateForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Update
          </Button>
        </CardHeader>
        <CardContent>
          {/* Add Update Form */}
          {showUpdateForm && (
            <form onSubmit={submitUpdate} className="mb-8 p-4 border border-border rounded-lg bg-muted/30 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="update-title">Title *</Label>
                <Input
                  id="update-title"
                  placeholder="e.g., Glazing complete — ready for kiln"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-desc">Description</Label>
                <Textarea
                  id="update-desc"
                  placeholder="Additional details about this update..."
                  value={updateDescription}
                  onChange={(e) => setUpdateDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Photos and PDF documents</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    const invalidFile = files.find((file) => {
                      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
                      return !file.type.startsWith("image/") && !isPdf
                    })
                    const oversizedFile = files.find((file) => {
                      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
                      return file.size > (isPdf ? 12 : 8) * 1024 * 1024
                    })
                    if (invalidFile) {
                      setUpdateError(`${invalidFile.name} is not an image or PDF.`)
                      e.target.value = ""
                      return
                    }
                    if (oversizedFile) {
                      setUpdateError(`${oversizedFile.name} is too large. Images can be 8MB and PDFs can be 12MB.`)
                      e.target.value = ""
                      return
                    }
                    setUpdateError(files.length > 10 ? "Choose no more than 10 files for one update." : "")
                    setUpdateFiles(files.slice(0, 10))
                  }}
                  accept="image/*,application/pdf,.pdf"
                  multiple
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {updateFiles.length > 0 ? `${updateFiles.length} selected` : "Choose files"}
                </Button>
                <p className="text-xs text-muted-foreground">Up to 10 files. Images: 8MB each. PDFs: 12MB each.</p>
                {updateFiles.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {updateFiles.map((file, i) => {
                      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
                      return (
                        <div key={`${file.name}-${file.lastModified}`} className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-2">
                          {isPdf ? (
                            <FileText className="h-9 w-9 shrink-0 text-primary" />
                          ) : (
                            <img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatAttachmentSize(file.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => setUpdateFiles((current) => current.filter((_, index) => index !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {updateError && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {updateError}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={addingUpdate}>
                  {addingUpdate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Post Update
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowUpdateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Timeline */}
          {order.updates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No updates yet. Add the first progress update above.
            </p>
          ) : (
            <div className="space-y-6">
              {order.updates.map((update) => {
                const images = parseOrderImageUrls(update.images)
                const attachments = parseOrderAttachments(update.attachments)
                return (
                  <div key={update.id} className="relative pl-6 border-l-2 border-border">
                    <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <h4 className="font-medium text-foreground">{update.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(update.createdAt).toLocaleString()}
                      </p>
                      {update.description && (
                        <p className="text-sm text-muted-foreground mt-2">{update.description}</p>
                      )}
                      {images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {images.map((url, i) => (
                            <div key={i} className="w-24 h-24 rounded-lg overflow-hidden border bg-muted">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      {attachments.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {attachments.map((attachment) => (
                            <a
                              key={attachment.path}
                              href={`/api/orders/${order.id}/attachments?path=${encodeURIComponent(attachment.path)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-3 transition-colors hover:bg-muted/60"
                            >
                              <FileText className="h-8 w-8 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{attachment.name}</span>
                                <span className="block text-xs text-muted-foreground">PDF · {formatAttachmentSize(attachment.size)}</span>
                              </span>
                              <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
