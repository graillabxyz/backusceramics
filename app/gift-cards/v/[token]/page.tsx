import Link from "next/link"
import { Download, Gift } from "lucide-react"
import { notFound } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/pos-catalog"
import { getGiftVoucherTitle } from "@/lib/gift-vouchers"

export default async function GiftVoucherPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const voucher = await prisma.giftVoucher.findUnique({ where: { token } })
  if (!voucher || voucher.status === "PENDING_PAYMENT" || voucher.status === "CANCELLED") notFound()
  return <main className="min-h-screen bg-background"><Navigation /><section className="mx-auto max-w-4xl px-4 pb-16 pt-28 sm:px-6"><div className="overflow-hidden rounded-2xl border border-primary/20 bg-[#fffaf0] text-[#1f2923] shadow-lg"><div className="grid gap-8 p-7 sm:p-12 md:grid-cols-[1fr_260px] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#9d5137]">Backus Ceramics</p><Gift className="mt-8 h-10 w-10 text-[#9d5137]" /><h1 className="mt-5 font-heading text-3xl font-bold sm:text-5xl">{getGiftVoucherTitle(voucher)}</h1>{voucher.recipientName && <p className="mt-4 text-xl italic text-[#666b65]">For {voucher.recipientName}</p>}{voucher.message && <p className="mt-6 max-w-xl whitespace-pre-wrap text-[#666b65]">{voucher.message}</p>}<div className="mt-8 space-y-1"><p className="font-mono text-sm font-bold text-[#9d5137]">{voucher.code}</p><p className="text-sm text-[#666b65]">{voucher.type === "CASH" ? `${formatPrice(voucher.remainingAmount)} remaining` : `${voucher.remainingClassDays} of ${voucher.classDays} class days remaining for ${voucher.participants} ${voucher.participants === 1 ? "person" : "people"}`}</p></div></div><div className="rounded-xl bg-white p-4 text-center"><img src={`/api/gift-vouchers/${encodeURIComponent(token)}/qr`} alt={`QR code for voucher ${voucher.code}`} className="mx-auto aspect-square w-full" /><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#1f2923]">Scan at our POS</p></div></div></div><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><a href={`/api/gift-vouchers/${encodeURIComponent(token)}/download`}><Download className="mr-2 h-4 w-4" />Download printable PDF</a></Button><Button asChild variant="outline"><Link href="/gift-cards">Buy a gift voucher</Link></Button></div><p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted-foreground">Keep this QR code private. Anyone who has it can redeem the available class days or cash balance.</p></section><Footer /></main>
}
