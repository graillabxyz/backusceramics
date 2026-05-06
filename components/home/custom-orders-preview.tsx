import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Lamp, Home, Palette } from "lucide-react"

const customCategories = [
  {
    icon: Palette,
    title: "Tableware Sets",
    description: "Custom dinnerware sets, espresso cups, bowls, and plates for your home or business"
  },
  {
    icon: Lamp,
    title: "Lighting & Decor",
    description: "Ceramic hanging lamps, wall lamps, and sculptural lighting pieces"
  },
  {
    icon: Home,
    title: "Vases & Vessels",
    description: "Small, medium, and large vases, plus decorative bowls and sculptural pieces"
  }
]

export function CustomOrdersPreview() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16">
          <div>
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Made to Order
            </span>
            <h2 className="mt-2 text-4xl sm:text-5xl text-foreground tracking-tight">
              Custom Orders
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl">
              Commission bespoke ceramic pieces tailored to your vision. From tableware 
              sets to home decor and sculptural works, we bring your ideas to life.
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <Button asChild>
              <Link href="/custom-orders">
                Start Your Order
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {customCategories.map((category) => (
            <div 
              key={category.title}
              className="p-8 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <category.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-heading font-bold text-xl text-foreground mb-2">
                {category.title}
              </h3>
              <p className="text-muted-foreground">
                {category.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-medium text-foreground">Sculptural Pieces & Tiles</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Available by request after consultation. Contact us to discuss your project.
              </p>
            </div>
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
