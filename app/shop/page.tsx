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
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg">
                  <img 
                    src="/wallofcups.jpeg" 
                    alt="The Wall of Cups at Backus Ceramics" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg translate-y-8">
                  <img 
                    src="/wallofcups2.jpg" 
                    alt="The Wall of Cups at Backus Ceramics" 
                    className="w-full h-full object-cover"
                  />
                </div>
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
            </div>
          </div>

          {/* Custom Orders Section */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h2 className="font-heading font-bold text-3xl">Custom Orders</h2>
              <p className="text-lg text-muted-foreground">
                Looking for something specific? We love creating custom pieces for 
                homes, cafes, and collections. From a single unique vase to a 
                complete dinnerware set, let's bring your vision to life.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Restaurant Ware
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Home Decor
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Gifts & Sets
                </div>
              </div>
              <Button asChild size="lg">
                <a href="https://wa.me/6282145890402?text=I'm interested in a custom ceramic order" target="_blank" rel="noopener noreferrer">
                  Inquire about Custom Orders
                </a>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src="/customorder1.JPG" 
                  alt="Custom ceramic order example" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg mt-12">
                <img 
                  src="/customorder2.PNG" 
                  alt="Custom ceramic order example" 
                  className="w-full h-full object-cover"
                />
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
