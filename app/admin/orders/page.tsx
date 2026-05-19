"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClipboardList, Search, Eye, Loader2 } from "lucide-react"
import Link from "next/link"

interface Order {
  id: string
  status: string
  contactName: string
  contactEmail: string
  contactLocation: string
  pieces: string
  createdAt: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  INQUIRY: "bg-blue-100 text-blue-800",
  REVIEWING: "bg-yellow-100 text-yellow-800",
  QUOTED: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  GLAZING: "bg-teal-100 text-teal-800",
  FIRING: "bg-red-100 text-red-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  CANCELLED: "bg-gray-100 text-gray-800",
}

const statusLabels: Record<string, string> = {
  INQUIRY: "New Inquiry",
  REVIEWING: "Reviewing",
  QUOTED: "Quoted",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  GLAZING: "Glazing",
  FIRING: "Firing",
  COMPLETED: "Completed",
  SHIPPED: "Shipped",
  CANCELLED: "Cancelled",
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders")
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.contactName.toLowerCase().includes(search.toLowerCase()) ||
      order.contactEmail.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getPieceCount = (piecesJson: string): number => {
    try {
      const pieces = JSON.parse(piecesJson)
      return pieces.reduce((sum: number, p: { quantity: string }) => sum + (parseInt(p.quantity) || 0), 0)
    } catch {
      return 0
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage custom order inquiries and track ongoing orders
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {orders.length} total order{orders.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="font-heading font-bold text-lg mb-2">
              {orders.length === 0 ? "No orders yet" : "No matching orders"}
            </CardTitle>
            <CardDescription>
              {orders.length === 0
                ? "Orders will appear here when customers submit inquiries."
                : "Try adjusting your search or filters."}
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-foreground truncate">
                        {order.contactName}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {order.contactEmail} · {order.contactLocation}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{getPieceCount(order.pieces)} pieces</span>
                      <span>·</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="font-mono text-xs">{order.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <Link href={`/admin/orders/${order.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
