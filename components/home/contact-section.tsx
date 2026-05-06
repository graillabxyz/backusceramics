import { Instagram, MessageCircle, Mail, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ContactSection() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground tracking-tight mb-6">
              Get in Touch
            </h2>
            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
              Whether you have questions about our residency programs, want to join a class, 
              or are interested in a custom commission, we're here to help.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Instagram className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Instagram</h3>
                  <a 
                    href="https://instagram.com/backusceramics" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    @backusceramics
                  </a>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">WhatsApp</h3>
                  <a 
                    href="https://wa.me/6282145890402" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    +62 821-4589-0402
                  </a>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Email</h3>
                  <a 
                    href="mailto:info@backusceramics.com" 
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    info@backusceramics.com
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-background rounded-2xl p-8 sm:p-12 shadow-sm border border-border">
            <h3 className="font-heading font-bold text-2xl mb-6">Visit Our Studio</h3>
            <p className="text-muted-foreground mb-8">
              We are located in the heart of Bali. Feel free to stop by and see our work in progress.
            </p>
            
            <div className="flex items-start gap-4 mb-10">
              <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <p className="font-medium">Bali, Indonesia</p>
                <p className="text-sm text-muted-foreground mb-3">Jl. Raya Kerobokan, Kuta Utara, Bali</p>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <a href="https://maps.app.goo.gl/d5FvjdfKAk6iSwrK8" target="_blank" rel="noopener noreferrer">
                    Get Directions
                  </a>
                </Button>
              </div>
            </div>
            
            <Button asChild className="w-full h-14 text-lg">
              <a 
                href="https://wa.me/6282145890402" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Message on WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
