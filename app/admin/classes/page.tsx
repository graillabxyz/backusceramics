"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Palette, Calendar, Baby } from "lucide-react"
import { workshops as initialWorkshops, Workshop, formatPrice } from "@/lib/classes-data"

const categoryIcons = {
  workshop: Palette,
  residency: Calendar,
  kids: Baby,
}

const categoryLabels = {
  workshop: "Workshop",
  residency: "Residency",
  kids: "Kids & Family",
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<Workshop[]>(initialWorkshops)
  const [editingClass, setEditingClass] = useState<Workshop | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    price: "",
    priceAltLabel: "",
    priceAltPrice: "",
    description: "",
    level: "",
    duration: "",
    schedule: "",
    features: "",
    category: "workshop" as Workshop["category"],
    available: true,
  })

  const handleEdit = (classItem: Workshop) => {
    setEditingClass(classItem)
    setFormData({
      title: classItem.title,
      subtitle: classItem.subtitle,
      price: classItem.price.toString(),
      priceAltLabel: classItem.priceAlt?.label || "",
      priceAltPrice: classItem.priceAlt?.price.toString() || "",
      description: classItem.description,
      level: classItem.level,
      duration: classItem.duration,
      schedule: classItem.schedule?.join("\n") || "",
      features: classItem.features.join("\n"),
      category: classItem.category,
      available: classItem.available,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingClass(null)
    setFormData({
      title: "",
      subtitle: "",
      price: "",
      priceAltLabel: "",
      priceAltPrice: "",
      description: "",
      level: "All Levels",
      duration: "",
      schedule: "",
      features: "",
      category: "workshop",
      available: true,
    })
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    const slug = formData.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    const classData: Workshop = {
      id: editingClass?.id || Date.now().toString(),
      slug: editingClass?.slug || slug,
      title: formData.title,
      subtitle: formData.subtitle,
      price: parseInt(formData.price),
      priceAlt: formData.priceAltLabel && formData.priceAltPrice 
        ? { label: formData.priceAltLabel, price: parseInt(formData.priceAltPrice) }
        : undefined,
      currency: "IDR",
      description: formData.description,
      level: formData.level,
      duration: formData.duration,
      schedule: formData.schedule.split("\n").filter(s => s.trim()),
      features: formData.features.split("\n").filter(f => f.trim()),
      category: formData.category,
      available: formData.available,
    }

    if (editingClass) {
      setClasses(classes.map(c => c.id === editingClass.id ? classData : c))
    } else {
      setClasses([...classes, classData])
    }
    setIsDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this class?")) {
      setClasses(classes.filter(c => c.id !== id))
    }
  }

  const toggleAvailability = (id: string) => {
    setClasses(classes.map(c => 
      c.id === id ? { ...c, available: !c.available } : c
    ))
  }

  const workshopClasses = classes.filter(c => c.category === "workshop")
  const residencyClasses = classes.filter(c => c.category === "residency")
  const kidsClasses = classes.filter(c => c.category === "kids")

  const renderClassCard = (classItem: Workshop) => {
    const Icon = categoryIcons[classItem.category]
    return (
      <Card key={classItem.id} className={!classItem.available ? "opacity-60" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-heading font-bold text-xl">{classItem.title}</CardTitle>
                <CardDescription>{classItem.subtitle}</CardDescription>
              </div>
            </div>
            <Badge variant={classItem.available ? "default" : "secondary"}>
              {classItem.available ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">{classItem.description}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground">Price</span>
              <p className="font-semibold text-foreground">{formatPrice(classItem.price)}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground">Duration</span>
              <p className="font-semibold text-foreground">{classItem.duration}</p>
            </div>
          </div>

          {classItem.priceAlt && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground">{classItem.priceAlt.label}</span>
              <p className="font-semibold text-foreground">{formatPrice(classItem.priceAlt.price)}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 bg-transparent"
              onClick={() => handleEdit(classItem)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => toggleAvailability(classItem.id)}
            >
              {classItem.available ? "Deactivate" : "Activate"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleDelete(classItem.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl font-medium text-foreground">Classes & Workshops</h1>
          <p className="text-muted-foreground mt-1">
            Manage your workshop offerings and pricing
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold">
                {editingClass ? "Edit Class" : "Add New Class"}
              </DialogTitle>
              <DialogDescription>
                {editingClass ? "Update the class details below" : "Fill in the details for the new class"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Class Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Beginner Wheel Class"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g., Meeting with the soil"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value: Workshop["category"]) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="residency">Residency</SelectItem>
                    <SelectItem value="kids">Kids & Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (IDR)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="650000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="2 hours"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priceAltLabel">Alt Price Label (optional)</Label>
                  <Input
                    id="priceAltLabel"
                    value={formData.priceAltLabel}
                    onChange={(e) => setFormData({ ...formData, priceAltLabel: e.target.value })}
                    placeholder="Parent & Child"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceAltPrice">Alt Price (IDR)</Label>
                  <Input
                    id="priceAltPrice"
                    type="number"
                    value={formData.priceAltPrice}
                    onChange={(e) => setFormData({ ...formData, priceAltPrice: e.target.value })}
                    placeholder="500000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select 
                  value={formData.level} 
                  onValueChange={(value) => setFormData({ ...formData, level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Beginner to Intermediate">Beginner to Intermediate</SelectItem>
                    <SelectItem value="All Levels">All Levels</SelectItem>
                    <SelectItem value="Kids & Families">Kids & Families</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the class..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule (one per line)</Label>
                <Textarea
                  id="schedule"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="Monday - Friday: 10:00 - 12:00 PM&#10;Saturday: 14:00 - 16:00 PM"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="features">Features (one per line)</Label>
                <Textarea
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="All materials included&#10;Pieces glazed and fired&#10;Ready in ~2 weeks"
                  rows={4}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="available">Class Available</Label>
                <Switch
                  id="available"
                  checked={formData.available}
                  onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent">Cancel</Button>
              <Button onClick={handleSave}>Save Class</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="workshops" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workshops">
            Workshops ({workshopClasses.length})
          </TabsTrigger>
          <TabsTrigger value="residency">
            Residency ({residencyClasses.length})
          </TabsTrigger>
          <TabsTrigger value="kids">
            Kids & Family ({kidsClasses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workshops" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {workshopClasses.map(renderClassCard)}
          </div>
          {workshopClasses.length === 0 && (
            <Card className="p-12 text-center">
              <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No workshop classes yet.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="residency" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {residencyClasses.map(renderClassCard)}
          </div>
          {residencyClasses.length === 0 && (
            <Card className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No residency programs yet.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="kids" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {kidsClasses.map(renderClassCard)}
          </div>
          {kidsClasses.length === 0 && (
            <Card className="p-12 text-center">
              <Baby className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No kids classes yet.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
