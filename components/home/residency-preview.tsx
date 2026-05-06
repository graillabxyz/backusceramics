import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, Clock, ArrowRight } from "lucide-react"
import { workshops, formatPrice } from "@/lib/classes-data"

export function ResidencyPreview() {
  const residencyPrograms = workshops.filter(w => w.category === "residency")

  return (
    <section className="py-24 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            Time, Depth and Process
          </span>
          <h2 className="mt-2 text-4xl sm:text-5xl text-foreground tracking-tight">
            Residency Programs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            A complete immersion into ceramics, from the very beginning of the process 
            to the final firing. Participants learn the foundations of working with clay, 
            alongside technical learning.
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Personal Mentorship</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Full Studio Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Complete Process</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {residencyPrograms.map((program) => (
            <Card key={program.id} className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">Program Image</span>
                </div>
                <CardTitle className="font-heading font-bold text-2xl">{program.title}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {program.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {program.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-semibold text-foreground">
                      {formatPrice(program.price)}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/residency#${program.id}`}>
                      View Program
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button asChild variant="outline" size="lg" className="bg-transparent">
            <Link href="/residency">
              Learn More About Residency
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
