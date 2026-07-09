import Link from "next/link"
import { ArrowRight, Coffee, Instagram, MapPin, MessageCircle, ShoppingBag, Video } from "lucide-react"
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
              Our physical shop in Bali brings together studio-made ceramic wares, the Wall of Cups,
              and a small pop-up cafe by Something Casual.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="https://wa.me/6282145890402?text=I'd like a video tour of the Backus Ceramics shop" target="_blank" rel="noopener noreferrer">
                  <Video className="mr-2 h-5 w-5" />
                  Ask for a video tour
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="https://maps.app.goo.gl/d5FvjdfKAk6iSwrK8" target="_blank" rel="noopener noreferrer">
                  <MapPin className="mr-2 h-5 w-5" />
                  Visit the shop
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-stretch">
          <div className="relative min-h-[520px] overflow-hidden rounded-sm bg-muted">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              poster="/wallofcups.jpeg"
            >
              <source src="/herovideo01.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Video tour</p>
              <h2 className="mt-3 max-w-2xl font-heading text-4xl font-bold sm:text-5xl">
                See what is on the shelves today
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
                The shop changes as pieces come out of the kiln. If you are not nearby, message us and
                we can send a quick video walkthrough of cups, tableware, lamps, sinks, and current studio wares.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-8 border-y border-border py-8 lg:py-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">In the studio</p>
              <h2 className="mt-3 font-heading text-4xl font-bold text-foreground">A shop for objects you can hold</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                We sell functional ceramics made by the studio: cups, vases, tableware, lamps, sinks,
                and one-off pieces that do not always make it online before they are gone. The online shop
                is a window into the inventory, but the physical space is where you can feel weight, texture,
                glaze, and scale.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border-t border-border pt-5">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-heading text-xl font-bold text-foreground">Ceramic wares</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Finished pieces are released gradually as they are photographed, priced, and ready for sale.
                </p>
              </div>
              <div className="border-t border-border pt-5">
                <Coffee className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-heading text-xl font-bold text-foreground">Something Casual</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  A casual pop-up cafe inside the shop, serving drinks and food around the studio rhythm.
                </p>
              </div>
            </div>
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

      <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Pop-up cafe</p>
            <h2 className="mt-3 font-heading text-4xl font-bold text-foreground">Something Casual inside Backus</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              The shop also hosts Something Casual, a small cafe project inside the studio. Come for cups,
              stay for coffee, tea, something sweet, or a simple bite while you look through the shelves.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a href="https://www.instagram.com/somethingcasual.bali/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="mr-2 h-4 w-4" />
                  @somethingcasual.bali
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="https://wa.me/6282145890402?text=I'd like to ask about the cafe at Backus Ceramics" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ask what is serving today
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { image: "/ambiance.JPG", label: "Inside the shop" },
              { image: "/wallofcups2.jpg", label: "Cups and coffee" },
              { image: "/customorder2.jpeg", label: "Studio table" },
            ].map((item) => (
              <a
                key={item.image}
                href="https://www.instagram.com/somethingcasual.bali/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-sm bg-muted"
              >
                <div className="aspect-[4/5]">
                  <img
                    src={item.image}
                    alt={item.label}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 pt-16 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Instagram preview</p>
                  <p className="mt-1 font-medium">{item.label}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
