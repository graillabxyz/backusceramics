import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, MessageCircle, Instagram, Video } from "lucide-react"

export function ShopPreview() {
  return (
    <section className="py-24 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="/wallofcups.jpeg" 
                  alt="Backus Ceramics Wall of Cups" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl translate-y-12">
                <img 
                  src="/wallofcups2.jpg" 
                  alt="Backus Ceramics Wall of Cups" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            {/* Decorative element */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 rounded-full blur-3xl" />
          </div>

          <div className="space-y-8">
            <div>
              <span className="text-sm font-medium text-primary uppercase tracking-wider">
                Our Collection
              </span>
              <h2 className="mt-2 text-4xl sm:text-5xl text-foreground tracking-tight font-heading font-bold">
                The Wall of Cups
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                Our inventory changes daily as pieces are finished and find new homes. 
                Browse available cups online, or ask us for a quick video tour of the
                current wall.
              </p>
            </div>

            <div className="p-8 bg-secondary/30 rounded-2xl border border-border">
              <h3 className="font-heading font-bold text-xl mb-3 flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Live Video Tours
              </h3>
              <p className="text-muted-foreground mb-6">
                Message us and we'll send you a quick video of what's on the wall 
                today. See the textures and colors in natural light before you choose.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild className="gap-2">
                  <a href="https://wa.me/6282145890402?text=I'd like a video tour of the Wall of Cups" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp Tour
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2 bg-transparent">
                  <Link href="/wall-of-cups">
                    View Cups
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
