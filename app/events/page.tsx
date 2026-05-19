import React from "react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cake, Users, Clock, Coffee, Sparkles, MessageCircle, ArrowRight, Palette, GlassWater, Wine } from "lucide-react"
import { formatPrice } from "@/lib/classes-data"

const birthdayOptions = [
  {
    id: "birthday-kids",
    title: "Option 1 — Kids Only",
    price: 3000000,
    includes: "Up to 5 children",
    max: "8 children max",
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
    max: "4 duos (8 people) max",
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
    max: "8 adults max",
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

const privateAtelier = {
  id: "private-atelier",
  title: "Private Atelier & Aperitivo",
  price: 5500000,
  includes: "Up to 6 people",
  max: "8 people max",
  additional: "750k per additional person",
  features: [
    "2h guided premium workshop",
    "Curated artisanal grazing board",
    "Natural wines or artisanal mocktails",
    "Curated studio ambiance & music",
    "Glazing & firing of all pieces"
  ]
}

export default function EventsPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">Private Gatherings</Badge>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight text-balance leading-[1.1]">
              Private Events & <br />Creative Ateliers
            </h1>
            <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
              Curated experiences designed to slow down and celebrate. From intimate 
              birthdays to private creative retreats, we tailor each event to your 
              group&apos;s unique energy.
            </p>
          </div>
        </div>
      </section>

      {/* Birthday Section */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-primary mb-4">
                <Cake className="h-6 w-6" />
                <span className="text-sm font-bold uppercase tracking-widest">Celebrations</span>
              </div>
              <h2 className="text-4xl font-heading font-bold">Creative Birthday Atelier</h2>
              <p className="text-muted-foreground mt-4">
                A curated birthday experience combining creativity, refreshments, 
                and a warm, welcoming atmosphere.
              </p>
            </div>
            <div className="relative w-full md:w-1/3 aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
              <img src="/birthday.jpeg" alt="Birthday" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {birthdayOptions.map((option) => (
              <Card key={option.id} className="flex flex-col border-border hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-heading font-bold">{option.title}</CardTitle>
                  <CardDescription className="text-lg font-medium text-primary mt-2">
                    {formatPrice(option.price)}
                  </CardDescription>
                  <div className="flex flex-col gap-1 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{option.includes}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 flex-1">
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
                    <p className="text-xs text-muted-foreground mb-4">{option.max} · {option.additional}</p>
                    <Button asChild className="w-full gap-2">
                      <a href={`https://wa.me/6282145890402?text=Hi! I'd like to book the Birthday Atelier: ${option.title}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" />
                        Inquire
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Private Atelier Section */}
      <section className="py-24 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="flex items-center gap-2 text-primary mb-4">
                <Wine className="h-6 w-6" />
                <span className="text-sm font-bold uppercase tracking-widest">Curated Experience</span>
              </div>
              <h2 className="text-4xl font-heading font-bold mb-6">{privateAtelier.title}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                The ultimate studio experience for friends or small teams. We combine 
                a premium guided workshop with a curated aperitivo hour, featuring 
                artisanal grazing boards and natural wines.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-10">
                {privateAtelier.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-foreground font-medium">
                    <Sparkles className="h-5 w-5 text-primary shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-8 bg-background rounded-2xl border border-border shadow-sm">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Starts from</p>
                  <p className="text-3xl font-heading font-bold text-primary">{formatPrice(privateAtelier.price)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{privateAtelier.includes} · {privateAtelier.max}</p>
                </div>
                <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 gap-2 ml-auto">
                  <a href={`https://wa.me/6282145890402?text=Hi! I'd like to book the Private Atelier & Aperitivo`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Book Private Event
                  </a>
                </Button>
              </div>
            </div>

            <div className="order-1 lg:order-2 relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/ambiance.JPG" 
                alt="Private Atelier Ambiance" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
