import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, LockKeyhole, ReceiptText } from "lucide-react"
import { getPaymentLinkStatus, paymentLinkPurposeLabels, type PaymentLinkPurpose } from "@/lib/custom-payment-links"
import { formatPrice } from "@/lib/pos-catalog"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Secure payment | Backus Ceramics",
  robots: { index: false, follow: false },
}

function formatExpiry(value: Date) {
  return value.toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  })
}

export default async function CustomPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ payment?: string }>
}) {
  const { token } = await params
  const { payment } = await searchParams
  const link = /^[A-Za-z0-9_-]{20,80}$/.test(token)
    ? await prisma.customPaymentLink.findUnique({
        where: { token },
        include: {
          sales: {
            orderBy: { createdAt: "desc" },
            select: { status: true },
          },
        },
      })
    : null

  if (link && !link.openedAt) {
    await prisma.customPaymentLink.updateMany({
      where: { id: link.id, openedAt: null },
      data: { openedAt: new Date() },
    })
  }

  const status = link ? getPaymentLinkStatus(link) : "NOT_FOUND"
  const isPaid = status === "PAID"
  const isActive = status === "ACTIVE" && Boolean(link?.checkoutUrl)

  return (
    <main className="min-h-screen bg-[#f3ede4] text-[#211b18]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <header className="flex items-center justify-between border-b border-black/15 pb-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Backus Ceramics home">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#30251f] text-sm font-bold text-white">B</span>
            <span>
              <span className="block text-sm font-semibold">Backus Ceramics</span>
              <span className="block text-xs text-black/55">Secure payment</span>
            </span>
          </Link>
          <span className="hidden items-center gap-2 text-xs font-medium text-black/55 sm:flex">
            <LockKeyhole className="h-4 w-4" /> Protected by Xendit
          </span>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-16">
          <section className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              {link ? paymentLinkPurposeLabels[link.purpose as PaymentLinkPurpose] || "Payment request" : "Payment request"}
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              {link?.title || "This payment link is unavailable"}
            </h1>
            {link?.description && <p className="mt-5 max-w-xl text-base leading-7 text-black/60">{link.description}</p>}

            <div className="mt-10 grid gap-4 border-y border-black/15 py-6 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-black/45">Amount due</p>
                <p className="mt-1 text-3xl font-semibold">{link ? formatPrice(link.amount) : "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-black/45">Valid until</p>
                <p className="mt-2 text-sm font-medium">{link ? formatExpiry(link.expiresAt) : "Unavailable"}</p>
                <p className="mt-1 text-xs text-black/45">Bali time</p>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-black/55">
              <ReceiptText className="mt-0.5 h-5 w-5 shrink-0" />
              <p>The amount and payment description are fixed by Backus Ceramics. Card and supported local payment methods are handled securely on Xendit.</p>
            </div>
          </section>

          <aside className="border border-black/15 bg-white/45 p-6 shadow-[0_18px_60px_rgba(48,37,31,0.08)] sm:p-8">
            {isPaid ? (
              <div className="py-5 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
                <h2 className="mt-4 text-2xl font-semibold">Payment received</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">Thank you. Backus Ceramics has received confirmation of this payment.</p>
              </div>
            ) : isActive ? (
              <>
                {payment === "cancelled" && (
                  <div className="mb-5 border border-amber-700/25 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Payment was not completed. You can safely try again.
                  </div>
                )}
                {payment === "success" && (
                  <div className="mb-5 border border-emerald-700/25 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Xendit is confirming your payment. This page will show paid once confirmation arrives.
                  </div>
                )}
                <h2 className="text-xl font-semibold">Complete your payment</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">You’ll continue to Xendit to choose a payment method and finish securely.</p>
                <a href={link!.checkoutUrl} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 bg-[#30251f] px-5 text-sm font-semibold text-white transition hover:bg-black">
                  <CreditCard className="h-4 w-4" /> Pay {formatPrice(link!.amount)}
                </a>
                <p className="mt-4 flex items-center justify-center gap-2 text-xs text-black/45"><LockKeyhole className="h-3.5 w-3.5" /> Secure checkout by Xendit</p>
              </>
            ) : (
              <div className="py-5 text-center">
                <Clock3 className="mx-auto h-10 w-10 text-black/45" />
                <h2 className="mt-4 text-2xl font-semibold">Link unavailable</h2>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  {status === "EXPIRED" ? "This payment request has expired." : "This payment request is no longer active."} Please ask Backus Ceramics for a new link.
                </p>
              </div>
            )}
          </aside>
        </div>

        <footer className="border-t border-black/15 pt-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-black/55 hover:text-black"><ArrowLeft className="h-4 w-4" /> Back to Backus Ceramics</Link>
        </footer>
      </div>
    </main>
  )
}
