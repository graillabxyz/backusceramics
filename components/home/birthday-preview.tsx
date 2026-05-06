import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Cake, Sparkles } from "lucide-react"

export function BirthdayPreview() {
  return (
    <section className="py-24 bg-secondary/30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 space-y-8">
            <div>
              <div className="flex items-center gap-2 text-primary mb-4">
                <Cake className="h-6 w-6" />
                <span className="text-sm font-bold uppercase tracking-widest">Celebrate with us</span>
              </div>
              <h2 className="text-4xl sm:text-5xl text-foreground tracking-tight font-heading font-bold leading-[1.1]">
                Creative Birthday <br />Atelier
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                A unique way to celebrate. Combine the joy of creating with a 
                warm, curated atmosphere, fresh drinks, and homemade treats. 
                Tailored for kids, duos, and adults.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="h-14 px-8 text-lg gap-2">
                <Link href="/birthday">
                  Explore Birthday Options
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="lg:w-1/2 relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="/birthday.jpeg" 
                alt="Birthday celebration" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              
              <div className="absolute bottom-6 left-6 right-6 p-6 bg-background/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-lg">Curated Experience</p>
                    <p className="text-sm text-muted-foreground">Natural decorations, refreshments, and guided workshops included.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Background decorative circles */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
