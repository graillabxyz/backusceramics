import Link from "next/link"
import { ArrowRight, MapPin, ShoppingCart } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { WallOfCupsGrid } from "@/components/shop/wall-of-cups-grid"
import { prisma } from "@/lib/prisma"
import { parseProductImageUrls } from "@/lib/pos-catalog"

export const revalidate = 60

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
            <WallOfCupsGrid cups={cups.map((cup) => ({
              id: cup.id,
              slug: cup.slug,
              name: cup.name,
              category: cup.category,
              price: cup.price,
              quantity: cup.quantity,
              volumeMl: cup.volumeMl,
              image: firstImage(cup.imageUrls),
            }))} />
          ) : (
            <div className="border-y border-border py-16">
              <h2 className="font-heading text-3xl font-bold text-foreground">The wall is being refreshed.</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                New cups are being photographed and added. Check back soon or visit the shop to see the current studio selection.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="font-heading text-3xl font-bold text-foreground">Buy online or visit the wall in Bali</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Every cup shown here is available for secure online checkout while stock lasts. The best cup is still usually the one your hand chooses, so you can also visit the studio.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/shop/checkout">
                <ShoppingCart className="mr-2 h-5 w-5" />
                View cart
              </Link>
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
