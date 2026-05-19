"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ProfilePage() {
  const { user, logout } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-foreground">Profile</h2>
        <p className="text-muted-foreground mt-1">Your account information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading font-bold text-lg">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            {user?.image ? (
              <img
                src={user.image}
                alt=""
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-semibold text-primary">
                  {user?.name?.[0] || "?"}
                </span>
              </div>
            )}
            <div>
              <p className="text-lg font-medium text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {user?.role?.toLowerCase()}
              </Badge>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <Button variant="outline" onClick={() => logout()}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
