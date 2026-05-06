import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground tracking-tight">
              About Backus Ceramics
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              A ceramics studio in the heart of Bali, dedicated to the craft 
              of handmade pottery and sharing the joy of working with clay.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Studio Image</span>
            </div>
            <div>
              <h2 className="font-heading font-bold text-3xl font-medium text-foreground mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Backus Ceramics was founded with a simple vision: to create beautiful, 
                  functional pottery and to share the meditative practice of working with 
                  clay with others.
                </p>
                <p>
                  Based in Bali, Indonesia, our studio draws inspiration from the island&apos;s 
                  rich artistic traditions while embracing contemporary aesthetics. Every 
                  piece that leaves our studio is handcrafted with intention and care.
                </p>
                <p>
                  Beyond creating pottery, we&apos;re passionate about teaching. Our residency 
                  programs welcome students from around the world to experience the full 
                  journey of ceramics—from wedging clay to opening the kiln after a firing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-3xl font-medium text-foreground mb-6">
            Our Philosophy
          </h2>
          <blockquote className="font-heading font-bold text-2xl text-foreground/80 italic leading-relaxed">
            &ldquo;There&apos;s something magical about taking a lump of earth and 
            transforming it into something beautiful and useful. It&apos;s a practice 
            that connects us to thousands of years of human creativity.&rdquo;
          </blockquote>
          <p className="mt-6 text-muted-foreground">— David Backus, Studio Founder</p>
        </div>
      </section>

      {/* The Studio Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="font-heading font-bold text-3xl font-medium text-foreground mb-6">
                The Studio
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Our studio is equipped with everything needed for the complete 
                  ceramic process. From electric wheels for throwing to a gas kiln 
                  for high-fire results, we&apos;ve created an environment where creativity 
                  can flourish.
                </p>
                <p>
                  The space is designed to feel welcoming and inspiring. Natural light 
                  fills the work areas, and the surrounding tropical landscape provides 
                  a peaceful backdrop for the focused work of making.
                </p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-3xl font-semibold text-foreground">4</p>
                  <p className="text-sm text-muted-foreground">Pottery Wheels</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">1</p>
                  <p className="text-sm text-muted-foreground">Gas Kiln</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">2</p>
                  <p className="text-sm text-muted-foreground">Students Max/Class</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">100+</p>
                  <p className="text-sm text-muted-foreground">Pieces Created</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Studio Interior Image</span>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading font-bold text-3xl font-medium text-foreground text-center mb-12">
            Our Process
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Preparation",
                description: "Wedging and preparing the clay to achieve the perfect consistency"
              },
              {
                step: "02",
                title: "Forming",
                description: "Shaping pieces on the wheel or through hand-building techniques"
              },
              {
                step: "03",
                title: "Glazing",
                description: "Applying our signature glazes, developed through careful experimentation"
              },
              {
                step: "04",
                title: "Firing",
                description: "High-fire gas kiln firing to bring out the best in each piece"
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="font-heading font-bold text-xl font-medium text-primary">{item.step}</span>
                </div>
                <h3 className="font-medium text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-3xl font-medium text-foreground mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-muted-foreground mb-8">
            Whether you&apos;re interested in joining a residency program or simply 
            want to learn more about our work, we&apos;d love to connect with you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/residency">
                Explore Residency Programs
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">
                Get in Touch
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
