"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Loader2 } from "lucide-react"

interface Application {
  id: string
  programId: string
  status: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  experience: string | null
  goals: string | null
  preferredDate: string | null
  notes: string | null
  createdAt: string
}

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  WAITLISTED: "bg-orange-100 text-orange-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/applications")
      if (res.ok) setApplications(await res.json())
    } catch (err) {
      console.error("Failed to fetch applications:", err)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setApplications((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        )
      }
    } catch (err) {
      console.error("Failed to update application:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground">Residency Applications</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage residency program applications
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="font-heading font-bold text-lg mb-2">No applications yet</CardTitle>
            <CardDescription>
              Residency applications will appear here when students apply.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-foreground">{app.contactName}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status]}`}>
                        {app.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {app.contactEmail} · Program: {app.programId}
                    </p>
                    {app.experience && (
                      <div className="text-sm">
                        <strong className="text-foreground">Experience:</strong>
                        <span className="text-muted-foreground ml-1">{app.experience}</span>
                      </div>
                    )}
                    {app.goals && (
                      <div className="text-sm">
                        <strong className="text-foreground">Goals:</strong>
                        <span className="text-muted-foreground ml-1">{app.goals}</span>
                      </div>
                    )}
                    {app.notes && (
                      <div className="text-sm">
                        <strong className="text-foreground">Notes:</strong>
                        <span className="text-muted-foreground ml-1">{app.notes}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Applied {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Select
                    value={app.status}
                    onValueChange={(val) => updateStatus(app.id, val)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUBMITTED">Submitted</SelectItem>
                      <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                      <SelectItem value="ACCEPTED">Accepted</SelectItem>
                      <SelectItem value="WAITLISTED">Waitlisted</SelectItem>
                      <SelectItem value="DECLINED">Declined</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
