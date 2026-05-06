import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Palette, Hand, Baby } from "lucide-react"
import { workshops, formatPrice } from "@/lib/classes-data"
import { BookingModal } from "@/components/classes/booking-modal"

const categoryIcons = {
  workshop: Palette,
  residency: Palette,
  kids: Baby,
}

export function ClassesPreview() {
  // Get a selection of classes for preview
  const previewClasses = [
    workshops.find(w => w.id === "beginner-wheel"),
    workshops.find(w => w.id === "3-day-workshop"),
    workshops.find(w => w.id === "kids-workshop"),
  ].filter(Boolean)

  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
          <div>
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Workshops & Classes
            </span>
            <h2 className="mt-2 text-4xl sm:text-5xl text-foreground tracking-tight">
              Learn the Art of Ceramics
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              From first-timers to experienced potters, we offer classes for every level. 
              All materials, glazing, and firing included.
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/classes">
                View All Classes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {previewClasses.map((workshop) => {
            if (!workshop) return null
            const Icon = workshop.id === "handbuilding" ? Hand : categoryIcons[workshop.category]
            return (
              <Card key={workshop.id} className="flex flex-col hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                  {workshop.image ? (
                    <img 
                      src={workshop.image} 
                      alt={workshop.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <Badge variant="outline">{workshop.level}</Badge>
                  </div>
                  <CardTitle className="font-heading font-bold text-xl">{workshop.title}</CardTitle>
                  <CardDescription className="text-xs text-primary font-medium uppercase tracking-wide">
                    {workshop.subtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2">
                    {workshop.description}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatPrice(workshop.price)}
                      </p>
                    </div>
                    <BookingModal workshop={workshop}>
                      <Button size="sm">Book Now</Button>
                    </BookingModal>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Schedule Banner */}
        <div className="mt-12 p-6 bg-muted/50 rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-medium text-foreground">Studio Schedule</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Monday - Saturday: 9:00 AM - 4:30 PM | Sunday: Closed
              </p>
            </div>
            <BookingModal workshop={workshops[0]}>
              <Button>Book a Class</Button>
            </BookingModal>
          </div>
        </div>
      </div>
    </section>
  )
}
