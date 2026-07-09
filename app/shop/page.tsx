import Link from "next/link"
import { ArrowRight, MessageCircle, ShoppingBag } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      <section className="px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Backus Ceramics</p>
            <h1 className="mt-4 font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Our Shop
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Ceramic wares made in the studio, released as they are finished, photographed, and ready
              to find a home.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          <Link href="/wall-of-cups" className="group relative min-h-[420px] overflow-hidden rounded-sm bg-muted">
            <img
              src="/wallofcups.jpeg"
              alt="Backus Ceramics Wall of Cups"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Collection</p>
              <h2 className="mt-3 font-heading text-4xl font-bold">Wall of Cups</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80">
                One-of-one cups for daily coffee, tea, and ceremony.
              </p>
              <span className="mt-6 inline-flex items-center text-sm font-semibold">
                Browse cups
                <ArrowRight className="ml-2 h-4 w-4" />
              </span>
            </div>
          </Link>

          <div className="flex min-h-[420px] flex-col justify-between rounded-sm border border-border bg-card p-6 sm:p-8">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Studio wares</p>
              <h2 className="mt-3 font-heading text-4xl font-bold text-foreground">More pieces coming online</h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                Lamps, tableware, vases, sinks, and other ceramic wares are being photographed for public release.
                Message us for current studio availability.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a href="https://wa.me/6282145890402?text=I'd like to ask what ceramic wares are available" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ask on WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/custom-orders">Custom orders</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
