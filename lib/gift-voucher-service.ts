import { Resend } from "resend"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildGiftVoucherPdf } from "@/lib/gift-voucher-pdf"
import { getGiftVoucherTitle } from "@/lib/gift-vouchers"

export const GIFT_VOUCHER_SALE_NOTE = "[gift-voucher]"

export function isGiftVoucherSale(notes: string | null | undefined) {
  return Boolean(notes?.includes(GIFT_VOUCHER_SALE_NOTE))
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.backusceramics.com").replace(/\/$/, "")
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

export async function sendGiftVoucherEmail(voucherId: string) {
  const voucher = await prisma.giftVoucher.findUnique({ where: { id: voucherId } })
  if (!voucher || voucher.status === "PENDING_PAYMENT" || voucher.status === "CANCELLED" || voucher.emailSentAt) return false
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set; gift voucher email was not sent", { voucherId })
    return false
  }

  const origin = siteOrigin()
  const pdf = await buildGiftVoucherPdf(voucher, origin)
  const deliveryEmail = voucher.recipientEmail?.trim() || voucher.purchaserEmail.trim()
  const recipient = voucher.recipientName?.trim() || "there"
  const voucherUrl = `${origin}/gift-cards/v/${encodeURIComponent(voucher.token)}`
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: deliveryEmail,
    subject: `Your Backus Ceramics gift voucher - ${voucher.code}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;color:#1f2923;line-height:1.55;">
        <p style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9d5137;">Backus Ceramics</p>
        <h1 style="font-size:28px;margin:10px 0 18px;">A gift of time with clay.</h1>
        <p>Hi ${escapeHtml(recipient)},</p>
        <p>Your <strong>${escapeHtml(getGiftVoucherTitle(voucher))}</strong> is ready. The printable voucher is attached and its QR code can be scanned directly at our POS.</p>
        ${voucher.message ? `<blockquote style="margin:24px 0;padding:16px 20px;border-left:3px solid #9d5137;background:#faf7f0;">${escapeHtml(voucher.message)}</blockquote>` : ""}
        <p><a href="${voucherUrl}" style="display:inline-block;background:#1f2923;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;">View and download voucher</a></p>
        <p style="font-size:13px;color:#6f716d;">Voucher code: ${escapeHtml(voucher.code)}. Keep the voucher private; anyone with its QR code can redeem it.</p>
      </div>
    `,
    attachments: [{ filename: `${voucher.code}.pdf`, content: Buffer.from(pdf) }],
  })
  if (error) {
    console.error("Gift voucher email failed", { error, voucherId })
    return false
  }
  await prisma.giftVoucher.updateMany({ where: { id: voucher.id, emailSentAt: null }, data: { emailSentAt: new Date() } })
  return true
}

export async function activateGiftVoucherForSale(saleId: string) {
  const now = new Date()
  const voucher = await prisma.$transaction(async (tx) => {
    await tx.giftVoucher.updateMany({
      where: { purchaseSaleId: saleId, status: "PENDING_PAYMENT" },
      data: { status: "ACTIVE", activatedAt: now },
    })
    return tx.giftVoucher.findUnique({ where: { purchaseSaleId: saleId } })
  })
  if (!voucher || voucher.status !== "ACTIVE") return voucher
  try {
    await sendGiftVoucherEmail(voucher.id)
  } catch (error) {
    console.error("Could not send activated gift voucher", { error, voucherId: voucher.id, saleId })
  }
  return voucher
}

export async function cancelGiftVoucherForSale(saleId: string) {
  return prisma.giftVoucher.updateMany({
    where: { purchaseSaleId: saleId, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })
}

export async function findGiftVoucher(db: Prisma.TransactionClient | typeof prisma, lookup: string) {
  return db.giftVoucher.findFirst({ where: { OR: [{ code: lookup.toUpperCase() }, { token: lookup }] } })
}

export function serializeGiftVoucher(voucher: {
  code: string
  token: string
  type: string
  status: string
  classDays: number | null
  participants: number
  initialAmount: number
  remainingAmount: number
  remainingClassDays: number
  recipientName: string | null
  message: string | null
  activatedAt: Date | null
  redeemedAt: Date | null
}) {
  return {
    code: voucher.code,
    token: voucher.token,
    type: voucher.type,
    status: voucher.status,
    classDays: voucher.classDays,
    participants: voucher.participants,
    initialAmount: voucher.initialAmount,
    remainingAmount: voucher.remainingAmount,
    remainingClassDays: voucher.remainingClassDays,
    recipientName: voucher.recipientName,
    message: voucher.message,
    activatedAt: voucher.activatedAt,
    redeemedAt: voucher.redeemedAt,
    title: getGiftVoucherTitle(voucher),
  }
}
