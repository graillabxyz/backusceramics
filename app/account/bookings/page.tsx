"use client"

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"

export default function MyBookingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-foreground">My Bookings</h2>
        <p className="text-muted-foreground mt-1">Your class and residency bookings</p>
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="font-heading font-bold text-lg mb-2">No bookings yet</CardTitle>
          <CardDescription>
            Book a class or apply for a residency program to see your bookings here.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}
