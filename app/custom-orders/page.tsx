"use client"

import React, { useState, useRef, useId } from "react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lamp, Home, Palette, Info, CheckCircle2, Plus, Trash2, Upload, X, ImageIcon } from "lucide-react"

interface OrderPiece {
  id: string
  pieceType: string
  dimensions: string
  quantity: string
  finishing: string
  images: File[]
  imageUrls: string[]
}

const pieceTypes = [
  { value: "dinner-plate", label: "Dinner Plate" },
  { value: "side-plate", label: "Side Plate" },
  { value: "soup-bowl", label: "Soup/Cereal Bowl" },
  { value: "pasta-bowl", label: "Pasta Bowl" },
  { value: "serving-platter", label: "Serving Platter" },
  { value: "serving-bowl", label: "Serving Bowl" },
  { value: "espresso-cup", label: "Espresso Cup" },
  { value: "coffee-mug", label: "Coffee/Tea Mug" },
  { value: "tea-set", label: "Tea Set (Pot + Cups)" },
  { value: "sake-cup", label: "Sake/Wine Cup" },
  { value: "hanging-lamp", label: "Hanging Pendant Lamp" },
  { value: "wall-lamp", label: "Wall Lamp/Sconce" },
  { value: "table-lamp", label: "Table Lamp" },
  { value: "small-vase", label: "Small Vase (10-20cm)" },
  { value: "medium-vase", label: "Medium Vase (20-35cm)" },
  { value: "large-vase", label: "Large Vase (35-50cm)" },
  { value: "floor-vase", label: "Floor Vase (50cm+)" },
  { value: "decorative-bowl", label: "Decorative Bowl" },
  { value: "sculptural-piece", label: "Sculptural Piece (Consultation Required)" },
  { value: "tiles", label: "Tiles (Consultation Required)" },
  { value: "other", label: "Other (Specify in Details)" },
]

const glazeFinishes = [
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin / Semi-matte" },
  { value: "glossy", label: "Glossy" },
  { value: "textured", label: "Textured" },
  { value: "unglazed", label: "Unglazed / Raw" },
  { value: "speckled", label: "Speckled" },
  { value: "reactive", label: "Reactive Glaze" },
  { value: "open", label: "Open to Suggestions" },
]

const colorOptions = [
  { value: "white-cream", label: "White / Cream / Off-white" },
  { value: "earth-tones", label: "Earth Tones (Browns, Tans)" },
  { value: "blues", label: "Blues / Ocean Tones" },
  { value: "greens", label: "Greens / Forest Tones" },
  { value: "neutrals", label: "Grays / Charcoal / Black" },
  { value: "terracotta", label: "Terracotta / Rust" },
  { value: "mixed", label: "Mixed / Multi-color" },
  { value: "natural", label: "Natural Clay (Unglazed)" },
  { value: "open", label: "Open to Suggestions" },
]



export default function CustomOrdersPage() {
  const baseId = useId()
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const pieceCounter = useRef(0)
  
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
  })

  const [pieces, setPieces] = useState<OrderPiece[]>(() => [{
    id: `${baseId}-piece-0`,
    pieceType: "",
    dimensions: "",
    quantity: "1",
    finishing: "",
    images: [],
    imageUrls: [],
  }])

  const [preferences, setPreferences] = useState({
    colorPreference: "",
    timeline: "",
    budget: "",
    inspiration: "",
    additionalNotes: "",
    howDidYouHear: "",
  })

  const addPiece = () => {
    pieceCounter.current += 1
    setPieces(prev => [
      ...prev,
      {
        id: `${baseId}-piece-${pieceCounter.current}`,
        pieceType: "",
        dimensions: "",
        quantity: "1",
        finishing: "",
        images: [],
        imageUrls: [],
      }
    ])
  }

  const removePiece = (id: string) => {
    if (pieces.length > 1) {
      const piece = pieces.find(p => p.id === id)
      if (piece) {
        piece.imageUrls.forEach(url => URL.revokeObjectURL(url))
      }
      setPieces(pieces.filter(p => p.id !== id))
    }
  }

  const updatePiece = (id: string, field: keyof OrderPiece, value: string | File[] | string[]) => {
    setPieces(pieces.map(piece => 
      piece.id === id ? { ...piece, [field]: value } : piece
    ))
  }

  const handleImageUpload = (pieceId: string, files: FileList | null) => {
    if (!files) return
    
    const piece = pieces.find(p => p.id === pieceId)
    if (!piece) return

    const newFiles = Array.from(files)
    const newImageUrls = newFiles.map(file => URL.createObjectURL(file))
    
    updatePiece(pieceId, "images", [...piece.images, ...newFiles])
    updatePiece(pieceId, "imageUrls", [...piece.imageUrls, ...newImageUrls])
  }

  const removeImage = (pieceId: string, imageIndex: number) => {
    const piece = pieces.find(p => p.id === pieceId)
    if (!piece) return

    URL.revokeObjectURL(piece.imageUrls[imageIndex])
    
    const newImages = piece.images.filter((_, i) => i !== imageIndex)
    const newImageUrls = piece.imageUrls.filter((_, i) => i !== imageIndex)
    
    updatePiece(pieceId, "images", newImages)
    updatePiece(pieceId, "imageUrls", newImageUrls)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      contact: contactInfo,
      pieces: pieces.map(piece => ({
        pieceType: piece.pieceType,
        dimensions: piece.dimensions,
        quantity: piece.quantity,
        finishing: piece.finishing,
        imageCount: piece.images.length,
      })),
      preferences,
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const data = await response.json().catch(() => ({}))
        console.error("Order submission failed:", data)
        alert("There was a problem submitting your order. Please try again or email us directly at backusceramics@gmail.com.")
      }
    } catch (err) {
      console.error("Network error:", err)
      alert("There was a problem submitting your order. Please try again or email us directly at backusceramics@gmail.com.")
    }

    setIsSubmitting(false)
  }

  if (submitted) {
    return (
      <main className="min-h-screen">
        <Navigation />
        <section className="pt-32 pb-24 bg-secondary/30">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-heading font-bold text-4xl text-foreground mb-4">
              Thank You for Your Inquiry!
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              We&apos;ve received your custom order request and will review the details carefully. 
              Expect to hear from us within 2-3 business days with a quote and timeline.
            </p>
            <Button asChild size="lg">
              <a href="/">Return Home</a>
            </Button>
          </div>
        </section>
        <Footer />
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/customorder1.JPG" 
            alt="Custom Ceramics background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/20" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">Made to Order</Badge>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight text-balance">
              Custom Order Worksheet
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Tell us about your vision. Add each piece you need to your order, 
              specify dimensions and finishing preferences, and attach reference images 
              to help us understand exactly what you&apos;re looking for.
            </p>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-20 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="grid gap-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Palette className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground text-xl">Tableware Sets</h3>
                    <p className="text-muted-foreground mt-2">
                      Dinner plates, bowls, cups, mugs, serving platters, and complete dining sets
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lamp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground text-xl">Lighting & Home Decor</h3>
                    <p className="text-muted-foreground mt-2">
                      Ceramic hanging lamps, wall lamps, sconces, and decorative home accents
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Home className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground text-xl">Vases & Vessels</h3>
                    <p className="text-muted-foreground mt-2">
                      Small, medium, and large vases, decorative bowls, and sculptural vessels
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-muted/50 rounded-2xl flex items-start gap-3 border border-border">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong>Sculptural pieces and tiles</strong> are available for custom order by request and after consultation. 
                  Please add them to your order below and we&apos;ll schedule a conversation to discuss your vision in detail.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src="/customorder2.jpeg" 
                  alt="Custom ceramic production" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-background p-6 rounded-2xl shadow-xl border border-border hidden sm:block">
                <p className="font-heading font-bold text-2xl text-primary">4-8 Weeks</p>
                <p className="text-sm text-muted-foreground">Average lead time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Form */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="space-y-12">
            
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading font-bold text-xl">Contact Information</CardTitle>
                <CardDescription>How can we reach you?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Your full name"
                      value={contactInfo.name}
                      onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone / WhatsApp</Label>
                    <Input
                      id="phone"
                      placeholder="+62 xxx xxx xxxx"
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location / Country *</Label>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={contactInfo.location}
                      onChange={(e) => setContactInfo({ ...contactInfo, location: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Pieces */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading font-bold text-xl">Your Order</CardTitle>
                <CardDescription>
                  Add each piece you&apos;d like to order. Include dimensions, quantity, and finishing preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {pieces.map((piece, index) => (
                  <div 
                    key={piece.id} 
                    className="p-6 border border-border rounded-lg bg-muted/20 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground">
                        Piece {index + 1}
                      </h4>
                      {pieces.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePiece(piece.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    {/* Piece Type */}
                    <div className="space-y-2">
                      <Label htmlFor={`pieceType-${piece.id}`}>Piece Type *</Label>
                      <Select
                        value={piece.pieceType}
                        onValueChange={(value) => updatePiece(piece.id, "pieceType", value)}
                        required
                      >
                        <SelectTrigger id={`pieceType-${piece.id}`}>
                          <SelectValue placeholder="Select piece type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Tableware</SelectLabel>
                            {pieceTypes.slice(0, 10).map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Lighting</SelectLabel>
                            {pieceTypes.slice(10, 13).map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Vases &amp; Vessels</SelectLabel>
                            {pieceTypes.slice(13, 18).map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Special</SelectLabel>
                            {pieceTypes.slice(18).map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dimensions and Quantity */}
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor={`dimensions-${piece.id}`}>
                          Dimensions / Volume
                        </Label>
                        <Input
                          id={`dimensions-${piece.id}`}
                          placeholder="e.g., 25cm diameter, 500ml, 30x40cm"
                          value={piece.dimensions}
                          onChange={(e) => updatePiece(piece.id, "dimensions", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Specify diameter, height, width, or volume as applicable
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`quantity-${piece.id}`}>Quantity *</Label>
                        <Input
                          id={`quantity-${piece.id}`}
                          type="number"
                          min="1"
                          placeholder="1"
                          value={piece.quantity}
                          onChange={(e) => updatePiece(piece.id, "quantity", e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          How many of this piece do you need?
                        </p>
                      </div>
                    </div>

                    {/* Finishing Details */}
                    <div className="space-y-2">
                      <Label htmlFor={`finishing-${piece.id}`}>Glaze & Finishing</Label>
                      <Select
                        value={piece.finishing}
                        onValueChange={(value) => updatePiece(piece.id, "finishing", value)}
                      >
                        <SelectTrigger id={`finishing-${piece.id}`}>
                          <SelectValue placeholder="Select glaze finish" />
                        </SelectTrigger>
                        <SelectContent>
                          {glazeFinishes.map(finish => (
                            <SelectItem key={finish.value} value={finish.value}>
                              {finish.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-3">
                      <Label>Reference Images</Label>
                      <p className="text-sm text-muted-foreground">
                        Upload photos of similar pieces, sketches, or inspiration images
                      </p>
                      
                      {/* Uploaded Images Preview */}
                      {piece.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-3">
                          {piece.imageUrls.map((url, imgIndex) => (
                            <div key={imgIndex} className="relative group">
                              <div className="w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted">
                                <img
                                  src={url}
                                  alt={`Reference ${imgIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeImage(piece.id, imgIndex)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Upload Button */}
                      <div>
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[piece.id] = el }}
                          onChange={(e) => handleImageUpload(piece.id, e.target.files)}
                          accept="image/*"
                          multiple
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[piece.id]?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {piece.images.length > 0 ? "Add More Images" : "Upload Images"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Piece Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPiece}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Piece
                </Button>
              </CardContent>
            </Card>

            {/* Design Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading font-bold text-xl">Overall Preferences</CardTitle>
                <CardDescription>General preferences that apply to your entire order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="colorPreference">Color Palette</Label>
                    <Select
                      value={preferences.colorPreference}
                      onValueChange={(value) => setPreferences({ ...preferences, colorPreference: value })}
                    >
                      <SelectTrigger id="colorPreference">
                        <SelectValue placeholder="Select color direction" />
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map(color => (
                          <SelectItem key={color.value} value={color.value}>
                            {color.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeline">When do you need this by?</Label>
                    <Select
                      value={preferences.timeline}
                      onValueChange={(value) => setPreferences({ ...preferences, timeline: value })}
                    >
                      <SelectTrigger id="timeline">
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-month">Within 1 month</SelectItem>
                        <SelectItem value="1-2-months">1-2 months</SelectItem>
                        <SelectItem value="2-3-months">2-3 months</SelectItem>
                        <SelectItem value="3-6-months">3-6 months</SelectItem>
                        <SelectItem value="flexible">Flexible / No rush</SelectItem>
                        <SelectItem value="specific">Specific date (note below)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Approximate Budget (IDR)</Label>
                  <Select
                    value={preferences.budget}
                    onValueChange={(value) => setPreferences({ ...preferences, budget: value })}
                  >
                    <SelectTrigger id="budget">
                      <SelectValue placeholder="Select budget range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under-2m">Under 2,000,000</SelectItem>
                      <SelectItem value="2m-5m">2,000,000 - 5,000,000</SelectItem>
                      <SelectItem value="5m-10m">5,000,000 - 10,000,000</SelectItem>
                      <SelectItem value="10m-20m">10,000,000 - 20,000,000</SelectItem>
                      <SelectItem value="20m-50m">20,000,000 - 50,000,000</SelectItem>
                      <SelectItem value="50m+">50,000,000+</SelectItem>
                      <SelectItem value="discuss">Prefer to discuss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspiration">Inspiration & References</Label>
                  <Textarea
                    id="inspiration"
                    placeholder="Describe your vision, share links to images you like, or reference any styles/artists that inspire you. The more detail, the better we can understand your aesthetic."
                    rows={4}
                    value={preferences.inspiration}
                    onChange={(e) => setPreferences({ ...preferences, inspiration: e.target.value })}
                  />
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Production Time:</strong> Custom ceramic pieces require time for creation, 
                    drying, bisque firing, glazing, and final firing. Most orders take 
                    4-8 weeks minimum depending on complexity and quantity.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading font-bold text-xl">Additional Information</CardTitle>
                <CardDescription>Any other details that would help us</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="additionalNotes">Additional Notes or Questions</Label>
                  <Textarea
                    id="additionalNotes"
                    placeholder="Any specific requirements, questions about the process, shipping concerns, or other details you'd like us to know..."
                    rows={4}
                    value={preferences.additionalNotes}
                    onChange={(e) => setPreferences({ ...preferences, additionalNotes: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="howDidYouHear">How did you hear about us?</Label>
                  <Select
                    value={preferences.howDidYouHear}
                    onValueChange={(value) => setPreferences({ ...preferences, howDidYouHear: value })}
                  >
                    <SelectTrigger id="howDidYouHear">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="google">Google Search</SelectItem>
                      <SelectItem value="referral">Friend / Referral</SelectItem>
                      <SelectItem value="visited">Visited the studio</SelectItem>
                      <SelectItem value="took-class">Took a class with us</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="font-heading font-bold text-xl flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pieces.map((piece, index) => {
                    const pieceLabel = pieceTypes.find(t => t.value === piece.pieceType)?.label
                    return (
                      <div key={piece.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {pieceLabel || `Piece ${index + 1}`}
                        </span>
                        <span className="font-medium">
                          {piece.quantity}x {piece.dimensions && `(${piece.dimensions})`}
                        </span>
                      </div>
                    )
                  })}
                  <div className="pt-2 mt-2 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Total Pieces</span>
                      <span className="font-bold">
                        {pieces.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="font-medium">Reference Images</span>
                      <span className="font-bold">
                        {pieces.reduce((sum, p) => sum + p.images.length, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                We&apos;ll review your request and respond within 2-3 business days with a quote and timeline.
              </p>
              <Button 
                type="submit" 
                size="lg" 
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Custom Order Request"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <Footer />
    </main>
  )
}
