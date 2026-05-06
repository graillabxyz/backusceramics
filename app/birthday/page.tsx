import React from "react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cake, Users, Clock, Coffee, Sparkles, MessageCircle, ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/classes-data"

const birthdayOptions = [
  {
    id: "birthday-kids",
    title: "Option 1 — Kids Only",
    price: 3000000,
    includes: "Up to 5 children",
    max: "7 children max",
    additional: "400k per additional child",
    features: [
      "1.5h ceramic workshop",
      "Guided creative session",
      "Natural decoration",
      "Coconut water + hibiscus tea",
      "Homemade cookies + fruits plate"
    ]
  },
  {
    id: "birthday-duo",
    title: "Option 2 — Parent & Child",
    price: 3800000,
    includes: "Up to 4 duos (8 people)",
    max: "5 duos (10 people) max",
    additional: "500k per additional duo",
    features: [
      "1.5h ceramic workshop",
      "Guided creative session",
      "Natural decoration",
      "Coconut water + hibiscus tea",
      "Homemade cookies + mini brownies",
      "Glazing & firing of selected pieces"
    ]
  },
  {
    id: "birthday-adults",
    title: "Option 3 — Adults Only",
    price: 4500000,
    includes: "Up to 5 adults",
    max: "7 adults max",
    additional: "600k per person",
    features: [
      "1.5h ceramic workshop",
      "Guided creative session",
      "Natural decoration",
      "Coconut water + hibiscus tea",
      "Homemade cookies, coconut flan and fruits plate",
      "Glazing & firing of selected pieces"
    ]
  }
]

export default function BirthdayPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">Celebrations</Badge>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight text-balance leading-[1.1]">
              Creative Birthday Atelier
            </h1>
            <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
              A birthday moment to slow down, create, and celebrate. Backus Ceramics 
              offers a curated birthday experience combining creativity and a warm, 
              welcoming atmosphere.
            </p>
          </div>
        </div>
      </section>

      {/* Experience Details */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-heading font-bold mb-6">The Experience Includes</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Atmosphere</h4>
                      <p className="text-sm text-muted-foreground mt-1">Thoughtful natural decoration of the space</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Coffee className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Refreshments</h4>
                      <p className="text-sm text-muted-foreground mt-1">Fresh coconut water and homemade hibiscus tea</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Cake className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Treats</h4>
                      <p className="text-sm text-muted-foreground mt-1">Fruits plate, low-sugar cookies, brownies or flan</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Artistry</h4>
                      <p className="text-sm text-muted-foreground mt-1">Guided ceramic workshop adapted for your group</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-secondary/30 rounded-2xl border border-border">
                <p className="italic text-lg text-foreground">
                  "Each event is tailored to the group, ensuring a unique and memorable 
                  celebration that resonates with the slow living philosophy."
                </p>
              </div>
            </div>

            <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/ambiance.JPG" 
                alt="Birthday Ambiance" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Options */}
      <section className="py-24 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold">Select Your Atelier</h2>
            <p className="text-muted-foreground mt-4">Pricing based on group size and type</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {birthdayOptions.map((option) => (
              <Card key={option.id} className="flex flex-col border-border hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading font-bold">{option.title}</CardTitle>
                  <CardDescription className="text-lg font-medium text-primary mt-2">
                    {formatPrice(option.price)}
                  </CardDescription>
                  <div className="flex flex-col gap-1 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{option.includes}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>1.5h Workshop</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Inclusions</p>
                    <ul className="space-y-2">
                      {option.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Capacity & Extras</p>
                      <p className="text-sm font-medium">{option.additional}</p>
                      <p className="text-sm text-muted-foreground">{option.max}</p>
                    </div>
                    
                    <Button asChild className="w-full h-12 gap-2">
                      <a href={`https://wa.me/6282145890402?text=Hi! I'd like to book the Creative Birthday Atelier: ${option.title}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" />
                        Inquire via WhatsApp
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

import { Palette } from "lucide-react"
