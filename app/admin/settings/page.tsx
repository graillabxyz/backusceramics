"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Globe, Mail, Instagram, MapPin } from "lucide-react"

export default function AdminSettingsPage() {
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "Backus Ceramics",
    tagline: "Bali Pottery Studio & Residency",
    description: "A ceramics studio in Bali offering residency programs, pottery classes, and handcrafted ceramic pieces.",
    email: "info@backusceramics.com",
    phone: "",
    address: "Jl. Bantan Kangin No.1, Canggu, Kec. Kuta Utara, Kabupaten Badung, Bali 80631",
    instagram: "@backusceramics",
  })

  const [businessSettings, setBusinessSettings] = useState({
    currency: "IDR",
    timezone: "Asia/Makassar",
    residencyStartDate: "Jan 1st",
    maxStudentsPerClass: "2",
    totalSpotsPerTerm: "4",
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    newInquiryAlert: true,
    lowStockAlert: true,
    weeklyReport: false,
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // In production, this would save to database
    console.log("Settings saved:", { generalSettings, businessSettings, notificationSettings })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl font-medium text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your studio settings and preferences
          </p>
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading font-bold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Site Information
              </CardTitle>
              <CardDescription>
                Basic information about your studio that appears on the website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Studio Name</Label>
                  <Input
                    id="siteName"
                    value={generalSettings.siteName}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={generalSettings.tagline}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, tagline: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Site Description</Label>
                <Textarea
                  id="description"
                  value={generalSettings.description}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading font-bold flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>
                How customers can reach you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={generalSettings.email}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={generalSettings.phone}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, phone: e.target.value })}
                    placeholder="+62 xxx xxx xxxx"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={generalSettings.address}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    value={generalSettings.instagram}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, instagram: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading font-bold">Business Settings</CardTitle>
              <CardDescription>
                Configure your business operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={businessSettings.currency}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, currency: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={businessSettings.timezone}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, timezone: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading font-bold">Residency Configuration</CardTitle>
              <CardDescription>
                Default settings for residency programs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Residency Start Date</Label>
                  <Input
                    id="startDate"
                    value={businessSettings.residencyStartDate}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, residencyStartDate: e.target.value })}
                    placeholder="e.g., Jan 1st"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStudents">Max Students Per Class</Label>
                  <Input
                    id="maxStudents"
                    type="number"
                    value={businessSettings.maxStudentsPerClass}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, maxStudentsPerClass: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalSpots">Total Spots Per Term</Label>
                <Input
                  id="totalSpots"
                  type="number"
                  value={businessSettings.totalSpotsPerTerm}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, totalSpotsPerTerm: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading font-bold">Email Notifications</CardTitle>
              <CardDescription>
                Configure when you receive email notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive email notifications</p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">New Inquiry Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified when someone submits an inquiry</p>
                </div>
                <Switch
                  checked={notificationSettings.newInquiryAlert}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newInquiryAlert: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Low Stock Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified when products are running low</p>
                </div>
                <Switch
                  checked={notificationSettings.lowStockAlert}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, lowStockAlert: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Weekly Reports</p>
                  <p className="text-sm text-muted-foreground">Receive a weekly summary of activity</p>
                </div>
                <Switch
                  checked={notificationSettings.weeklyReport}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, weeklyReport: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
