import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, Calendar, Palette, Hand, Baby } from "lucide-react"
import Link from "next/link"
import { workshops, studioInfo, formatPrice } from "@/lib/classes-data"

const categoryIcons = {
  workshop: Palette,
  residency: Calendar,
  kids: Baby,
}

const categoryColors = {
  workshop: "bg-primary/10 text-primary",
  residency: "bg-accent/10 text-accent",
  kids: "bg-secondary text-secondary-foreground",
}

export default function ClassesPage() {
  const workshopClasses = workshops.filter(w => w.category === "workshop")
  const kidsClasses = workshops.filter(w => w.category === "kids")

  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">Workshops & Classes</Badge>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground tracking-tight text-balance">
              Learn the Art of Ceramics
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              From first-timers to experienced potters, we offer classes for every level. 
              Join us at our Bali studio to discover the joy of working with clay.
            </p>
          </div>
        </div>
      </section>

      {/* Schedule Overview */}
      <section className="py-12 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Studio Hours</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mon-Sat: {studioInfo.hours.weekdays}<br />
                  Sunday: {studioInfo.hours.sunday}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Small Groups</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalized attention with small class sizes
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Hand className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">All Inclusive</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Materials, glazing & firing included
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workshop Classes */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="font-heading font-bold text-3xl font-medium text-foreground">
              Wheel & Handbuilding Classes
            </h2>
            <p className="text-muted-foreground mt-2">
              Single-day and multi-day workshops for all skill levels
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workshopClasses.map((workshop) => {
              const Icon = categoryIcons[workshop.category]
              return (
                <Card key={workshop.id} className="flex flex-col">
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">Workshop Image</span>
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${categoryColors[workshop.category]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline">{workshop.level}</Badge>
                    </div>
                    <CardTitle className="font-heading font-bold text-xl">{workshop.title}</CardTitle>
                    <CardDescription className="text-xs text-primary font-medium uppercase tracking-wide">
                      {workshop.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {workshop.description}
                    </p>
                    
                    {workshop.schedule && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-foreground mb-1">Schedule</p>
                        {workshop.schedule.map((time, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{time}</p>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">From</p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatPrice(workshop.price)}
                        </p>
                      </div>
                      <Button asChild>
                        <Link href="/contact">Book Now</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Kids & Family */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="font-heading font-bold text-3xl font-medium text-foreground">
              Kids & Family Workshops
            </h2>
            <p className="text-muted-foreground mt-2">
              Creative clay experiences for children and families
            </p>
          </div>

          {kidsClasses.map((workshop) => (
            <Card key={workshop.id} className="overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="aspect-[4/3] md:aspect-auto bg-muted flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">Kids Workshop Image</span>
                </div>
                <div className="p-6 lg:p-8 flex flex-col justify-center">
                  <Badge variant="secondary" className="w-fit mb-4">{workshop.level}</Badge>
                  <h3 className="font-heading font-bold text-2xl font-medium text-foreground">
                    {workshop.title}
                  </h3>
                  <p className="text-sm text-primary font-medium uppercase tracking-wide mt-1">
                    {workshop.subtitle}
                  </p>
                  <p className="text-muted-foreground mt-4">
                    {workshop.description}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 mt-6">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium text-foreground">Kids Only</p>
                      <p className="text-2xl font-semibold text-foreground mt-1">
                        {formatPrice(workshop.price)}
                      </p>
                    </div>
                    {workshop.priceAlt && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium text-foreground">{workshop.priceAlt.label}</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">
                          {formatPrice(workshop.priceAlt.price)}
                        </p>
                      </div>
                    )}
                  </div>

                  {workshop.schedule && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {workshop.schedule[0]}
                    </div>
                  )}

                  <div className="mt-6">
                    <Button size="lg" asChild>
                      <Link href="/contact">Book a Session</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Residency CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-3xl font-medium">
            Looking for a Deeper Immersion?
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-2xl mx-auto">
            Our 3 and 6 week residency programs offer a complete journey into ceramics, 
            from shaping to final firing. Perfect for those seeking a transformative experience.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/residency">View Residency Programs</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Studio Info */}
      <section className="py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading font-bold text-2xl font-medium text-foreground text-center mb-8">
            Before Your Class
          </h2>
          <div className="bg-muted/50 rounded-xl p-6 lg:p-8">
            <ul className="space-y-4">
              {studioInfo.policies.map((policy, i) => (
                <li key={i} className="flex items-start gap-3 text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {policy}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground border-t border-border pt-6">
              Our teacher Julian is attentive and inspiring. And don&apos;t be surprised if our dogs 
              Copper and Dude come to say hello!
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
