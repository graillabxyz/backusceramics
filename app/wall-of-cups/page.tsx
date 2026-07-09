import Link from "next/link"
import { ArrowRight, MapPin, MessageCircle } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatPrice, parseProductImageUrls } from "@/lib/pos-catalog"

export const dynamic = "force-dynamic"

function firstImage(imageUrls: string | null) {
  return parseProductImageUrls(imageUrls)[0] || ""
}

export default async function WallOfCupsPage() {
  const cups = await prisma.posProduct
    .findMany({
      where: {
        category: "CUPS",
        status: "AVAILABLE",
        showInShop: true,
        cafeOnly: false,
        quantity: { gt: 0 },
      },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
    })
    .catch((error) => {
      console.error("Could not load public Wall of Cups", error)
      return []
    })

  return (
    <main className="min-h-screen bg-background">
      <Navigation />

      <section className="px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Backus Ceramics</p>
            <h1 className="mt-4 font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Wall of Cups
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A cup is a small artwork that enters daily life. It holds coffee, tea, heat, habit,
              and ceremony while still asking to be used.
            </p>
            <p className="mt-6 font-heading text-2xl leading-relaxed text-foreground">
              clay remembers touch<br />
              ceremony in a cup<br />
              today is my day
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {cups.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cups.map((cup) => {
                const image = firstImage(cup.imageUrls)

                return (
                  <Link
                    key={cup.id}
                    href={`/shop/${cup.slug}`}
                    className="group relative block overflow-hidden rounded-sm bg-muted"
                  >
                    <div className="aspect-[3/4]">
                      {image ? (
                        <img
                          src={image}
                          alt={cup.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          Image coming soon
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-20 text-white">
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-heading text-xl font-bold">{cup.name}</h2>
                          <p className="mt-1 text-sm text-white/75">
                            {cup.volumeMl ? `${cup.volumeMl} ml` : "One of one"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">{formatPrice(cup.price)}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="border-y border-border py-16">
              <h2 className="font-heading text-3xl font-bold text-foreground">The wall is being refreshed.</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                New cups are being photographed and added. Message us for the current studio selection.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="font-heading text-3xl font-bold text-foreground">Visit the wall in Bali</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The best cup is usually the one your hand chooses. Visit the studio or ask us for a short video tour.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="https://wa.me/6282145890402?text=I'd like to ask about the Wall of Cups" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://maps.app.goo.gl/d5FvjdfKAk6iSwrK8" target="_blank" rel="noopener noreferrer">
                <MapPin className="mr-2 h-5 w-5" />
                Directions
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
