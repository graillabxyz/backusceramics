"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardList } from "lucide-react"

export default function MyOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-foreground">My Orders</h2>
        <p className="text-muted-foreground mt-1">Track the progress of your custom orders</p>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="font-heading font-bold text-lg mb-2">No orders yet</CardTitle>
          <CardDescription>
            When you submit a custom order, it will appear here with live progress updates.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}
