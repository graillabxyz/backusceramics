import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Calendar, Users, Palette, Flame, Home } from "lucide-react"
import Link from "next/link"
import { workshops, formatPrice } from "@/lib/classes-data"

export default function ResidencyPage() {
  const residencyPrograms = workshops.filter(w => w.category === "residency")

  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">Time, Depth and Process</Badge>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground tracking-tight text-balance">
              Residency Programs
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              A complete immersion into ceramics, from the very beginning of the process 
              to the final firing. Learn the foundations of working with clay, alongside 
              deep technical learning.
            </p>
          </div>
        </div>
      </section>

      {/* Program Details */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Personal Mentorship</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Dedicated guidance from experienced instructors throughout your journey
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Complete Process</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Learn from shaping to glazing to final firing in our kilns
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Settlement Support</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We help you find accommodation and get settled in Bali
                </p>
              </div>
            </div>
          </div>

          {/* Programs Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {residencyPrograms.map((program) => (
              <Card key={program.id} id={program.id} className="bg-card border-border overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 group">
                <div className="aspect-video relative overflow-hidden bg-muted">
                  {program.image ? (
                    <img 
                      src={program.image} 
                      alt={program.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading font-bold text-2xl">{program.title}</CardTitle>
                    <Badge variant={program.available ? "default" : "secondary"}>
                      {program.available ? "Available" : "Full"}
                    </Badge>
                  </div>
                  <CardDescription className="text-muted-foreground text-base">
                    {program.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{program.duration}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Flame className="h-4 w-4" />
                        <span>{program.level}</span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-6">
                      <h4 className="font-medium text-foreground mb-4">What&apos;s Included</h4>
                      <ul className="space-y-3">
                        {program.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-border pt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="text-3xl font-semibold text-foreground">
                          {formatPrice(program.price)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <Button size="lg" asChild>
                          <Link href={`/residency/book/${program.slug}`}>Book Dates</Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/contact">Ask a question</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl font-medium text-foreground">
              Your Residency Journey
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              A transformative experience from your first touch of clay to taking home your finished pieces
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="font-heading font-bold text-2xl text-primary">1</span>
              </div>
              <h3 className="font-medium text-foreground mb-2">Foundations</h3>
              <p className="text-sm text-muted-foreground">
                Learn clay preparation, wedging techniques, and the fundamentals of working with clay
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="font-heading font-bold text-2xl text-primary">2</span>
              </div>
              <h3 className="font-medium text-foreground mb-2">Shaping</h3>
              <p className="text-sm text-muted-foreground">
                Master wheel throwing and handbuilding techniques to create your forms
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="font-heading font-bold text-2xl text-primary">3</span>
              </div>
              <h3 className="font-medium text-foreground mb-2">Glazing</h3>
              <p className="text-sm text-muted-foreground">
                Explore glazing techniques and color applications to finish your pieces
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="font-heading font-bold text-2xl text-primary">4</span>
              </div>
              <h3 className="font-medium text-foreground mb-2">Firing</h3>
              <p className="text-sm text-muted-foreground">
                Experience the magic of kiln firing and take home your finished creations
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading font-bold text-3xl font-medium text-foreground text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="font-medium text-foreground mb-2">
                Do I need prior experience?
              </h3>
              <p className="text-muted-foreground">
                No prior experience is necessary. Our residency programs are designed for all levels, 
                from complete beginners to those with some ceramics background.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                What should I bring?
              </h3>
              <p className="text-muted-foreground">
                All materials and tools are provided. We recommend bringing comfortable 
                clothes that can get dirty, and an apron if you have a favorite.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                Can you help with accommodation?
              </h3>
              <p className="text-muted-foreground">
                Yes! We help you find suitable accommodation near the studio and 
                assist with getting settled in Bali for your residency.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                How many pieces will I create?
              </h3>
              <p className="text-muted-foreground">
                This varies by student and program length, but most 3-week residents 
                complete 10-15 pieces, while 6-week residents often finish 25-30+ pieces.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                What is the payment and cancellation policy?
              </h3>
              <p className="text-muted-foreground">
                Payment is required in full when you book your dates to secure your residency spot. 
                Due to the significant undertaking of welcoming a new resident into the studio and 
                tailoring classes to your schedule, we do not offer refunds for cancellations. 
                If you have extenuating circumstances and would like us to consider an alternative 
                payment plan, please include the details in your initial message when applying.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Button size="lg" asChild>
              <Link href="/residency/book/3-week-residency">Book Residency Dates</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
