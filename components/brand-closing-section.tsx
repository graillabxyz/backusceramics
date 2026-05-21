import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BrandClosingSectionProps {
  eyebrow?: string
  title?: string
  body?: string
}

export function BrandClosingSection({
  eyebrow = "From the studio",
  title = "Come for the class, stay for the rhythm of clay.",
  body = "Backus Ceramics is a working Bali studio shaped by slow process, useful objects, and generous teaching. Whether you are booking your first wheel session or planning a deeper project, we will help you find the right pace.",
}: BrandClosingSectionProps) {
  return (
    <section className="border-y border-border bg-secondary/20 py-16">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Button asChild size="lg" className="gap-2">
            <Link href="/classes">
              Explore classes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <a href="https://wa.me/6282145890402" target="_blank" rel="noopener noreferrer">
              Ask the studio
              <MessageCircle className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
