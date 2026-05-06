import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Instagram, MessageCircle, ArrowRight, Video } from "lucide-react"
import Link from "next/link"

export default function ShopPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground tracking-tight">
              The Wall of Cups
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Our inventory is alive and constantly evolving. Each day, new pieces emerge 
              from the kiln, while others find their new homes. Because our collection 
              changes so rapidly, we invite you to experience it dynamically.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="/wallofcups.jpeg" 
                  alt="The Wall of Cups at Backus Ceramics" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            </div>
            
            <div className="order-1 lg:order-2 space-y-8">
              <div>
                <h2 className="font-heading font-bold text-3xl mb-4">Take a Video Tour</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Want to see what's currently on the wall? Message us for a personalized 
                  video tour. We'll show you exactly what's in stock today and help 
                  you find the perfect piece.
                </p>
              </div>

              <div className="grid gap-4">
                <Button asChild size="lg" className="h-16 text-lg gap-3">
                  <a href="https://wa.me/6282145890402" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-6 w-6" />
                    WhatsApp Video Tour
                    <ArrowRight className="h-5 w-5 ml-auto" />
                  </a>
                </Button>
                
                <Button asChild variant="outline" size="lg" className="h-16 text-lg gap-3 bg-transparent border-2">
                  <a href="https://instagram.com/backusceramics" target="_blank" rel="noopener noreferrer">
                    <Instagram className="h-6 w-6" />
                    DM on Instagram
                    <ArrowRight className="h-5 w-5 ml-auto" />
                  </a>
                </Button>

                <Button asChild variant="outline" size="lg" className="h-16 text-lg gap-3 bg-transparent border-2">
                  <a href="https://maps.app.goo.gl/d5FvjdfKAk6iSwrK8" target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-6 w-6" />
                    Get Directions
                    <ArrowRight className="h-5 w-5 ml-auto" />
                  </a>
                </Button>
              </div>

              <div className="p-8 bg-secondary/30 rounded-2xl border border-border">
                <h3 className="font-heading font-bold text-xl mb-3 flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  How it works
                </h3>
                <p className="text-muted-foreground">
                  Simply send us a message saying "I'd like a tour of the wall." 
                  We'll send over a quick video of our current inventory and can 
                  provide close-up photos and pricing for any pieces that catch your eye.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visit Us Section */}
      <section className="py-24 bg-secondary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-3xl sm:text-4xl mb-6">
            Visit Our Bali Studio
          </h2>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            The best way to experience the Wall of Cups is in person. Come feel the 
            textures, weight, and soul of each piece.
          </p>
          <div className="inline-flex flex-col items-center p-8 bg-background rounded-2xl shadow-sm border border-border">
            <p className="font-medium text-foreground mb-1">Open Monday - Saturday</p>
            <p className="text-muted-foreground mb-6">9:00 AM - 4:30 PM</p>
            <Button asChild variant="link" className="text-primary h-auto p-0 text-lg">
              <a href="https://maps.app.goo.gl/d5FvjdfKAk6iSwrK8" target="_blank" rel="noopener noreferrer">
                Get Directions <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
