import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  calculateClassGiftVoucherPrice,
  createGiftVoucherCode,
  createGiftVoucherToken,
  GIFT_VOUCHER_CLASS_PACKAGES,
  isGiftVoucherClassDays,
  MAX_CASH_GIFT_VOUCHER_IDR,
  MAX_GIFT_VOUCHER_PARTICIPANTS,
  MIN_CASH_GIFT_VOUCHER_IDR,
} from "@/lib/gift-vouchers"
import { GIFT_VOUCHER_SALE_NOTE } from "@/lib/gift-voucher-service"
import { getPaymentSessionExpiresAt } from "@/lib/payment-session"
import { getTrustedRequestOrigin } from "@/lib/request-origin"
import { checkRateLimit, cleanString, isRequestBodyTooLarge, isValidEmailAddress, rateLimitHeaders, safeHeaderValue } from "@/lib/server-security"
import { createXenditCustomerReference, createXenditPaymentSession, XenditApiError, XenditConfigurationError } from "@/lib/xendit"

const MAX_GIFT_VOUCHER_BODY_BYTES = 16 * 1024

function sanitizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "gift-voucher-checkout", limit: 10, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts. Please wait a moment." }, { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) })
  }
  if (isRequestBodyTooLarge(req, MAX_GIFT_VOUCHER_BODY_BYTES)) {
    return NextResponse.json({ error: "Gift voucher request is too large." }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Gift voucher request is invalid." }, { status: 400 })

  const type = data.type === "CASH" ? "CASH" : data.type === "CLASS" ? "CLASS" : ""
  const purchaserName = cleanString(data.purchaserName, 120)
  const purchaserEmail = safeHeaderValue(data.purchaserEmail, 254).toLowerCase()
  const recipientName = cleanString(data.recipientName, 120) || null
  const recipientEmail = safeHeaderValue(data.recipientEmail, 254).toLowerCase() || null
  const message = cleanString(data.message, 500) || null
  const participants = Number(data.participants || 1)
  const classDays = Number(data.classDays || 0)
  const cashAmount = Number(data.cashAmount || 0)

  if (!type || !purchaserName || !isValidEmailAddress(purchaserEmail)) {
    return NextResponse.json({ error: "Add your name and a valid purchase email." }, { status: 400 })
  }
  if (recipientEmail && !isValidEmailAddress(recipientEmail)) {
    return NextResponse.json({ error: "Enter a valid recipient email or leave it blank." }, { status: 400 })
  }
  if (!Number.isInteger(participants) || participants < 1 || participants > MAX_GIFT_VOUCHER_PARTICIPANTS) {
    return NextResponse.json({ error: `Choose between 1 and ${MAX_GIFT_VOUCHER_PARTICIPANTS} participants.` }, { status: 400 })
  }

  let amount = cashAmount
  let itemName = "Backus Ceramics Cash Gift Voucher"
  if (type === "CLASS") {
    if (!isGiftVoucherClassDays(classDays)) return NextResponse.json({ error: "Choose a 1, 3, or 6 day class voucher." }, { status: 400 })
    amount = calculateClassGiftVoucherPrice(classDays, participants)
    itemName = `${GIFT_VOUCHER_CLASS_PACKAGES[classDays].title} for ${participants} ${participants === 1 ? "person" : "people"}`
  } else if (!Number.isInteger(amount) || amount < MIN_CASH_GIFT_VOUCHER_IDR || amount > MAX_CASH_GIFT_VOUCHER_IDR) {
    return NextResponse.json({ error: `Cash gift vouchers must be between IDR ${MIN_CASH_GIFT_VOUCHER_IDR.toLocaleString("en-US")} and IDR ${MAX_CASH_GIFT_VOUCHER_IDR.toLocaleString("en-US")}.` }, { status: 400 })
  }

  const paymentReference = sanitizeReference(`gift_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)
  const paymentExpiresAt = getPaymentSessionExpiresAt()
  const code = createGiftVoucherCode()
  const token = createGiftVoucherToken()
  let createdSaleId = ""

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.posSale.create({
        data: {
          subtotal: amount,
          total: amount,
          status: "PENDING_PAYMENT",
          paymentMethod: "ONLINE",
          paymentReference,
          receiptEmail: purchaserEmail,
          fulfillmentMethod: "DIGITAL",
          notes: GIFT_VOUCHER_SALE_NOTE,
          items: {
            create: [{
              nameSnapshot: itemName,
              skuSnapshot: type === "CLASS" ? `GIFT-CLASS-${classDays}D` : "GIFT-CASH",
              categorySnapshot: "GIFT_VOUCHERS",
              unitPrice: amount,
              quantity: 1,
              subtotal: amount,
              lineTotal: amount,
            }],
          },
        },
        include: { items: true },
      })
      await tx.giftVoucher.create({
        data: {
          code,
          token,
          type,
          classDays: type === "CLASS" ? classDays : null,
          participants: type === "CLASS" ? participants : 1,
          initialAmount: amount,
          remainingAmount: type === "CASH" ? amount : 0,
          remainingClassDays: type === "CLASS" ? classDays : 0,
          purchaserName,
          purchaserEmail,
          recipientName,
          recipientEmail,
          message,
          paymentReference,
          purchaseSaleId: createdSale.id,
        },
      })
      return createdSale
    })
    createdSaleId = sale.id

    const origin = getTrustedRequestOrigin(req)
    const paymentSession = await createXenditPaymentSession({
      reference_id: paymentReference,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount,
      currency: "IDR",
      country: "ID",
      description: `Backus Ceramics gift voucher ${code}`,
      allow_save_payment_method: "DISABLED",
      locale: "en",
      expires_at: paymentExpiresAt.toISOString(),
      customer: {
        reference_id: createXenditCustomerReference(purchaserEmail, paymentReference),
        type: "INDIVIDUAL",
        email: purchaserEmail,
        individual_detail: { given_names: purchaserName },
      },
      items: [{ reference_id: code, type: "DIGITAL_PRODUCT", name: itemName, net_unit_amount: amount, quantity: 1, category: "GIFT_VOUCHER" }],
      metadata: {
        pos_sale_id: sale.id,
        pos_payment_reference: paymentReference,
        checkout_channel: "gift_voucher",
        gift_voucher_code: code,
      },
      success_return_url: `${origin}/gift-cards/success?token=${encodeURIComponent(token)}`,
      cancel_return_url: `${origin}/gift-cards?payment=cancelled`,
    })

    await prisma.$transaction([
      prisma.posSale.update({ where: { id: sale.id }, data: { paymentSessionId: paymentSession.payment_session_id } }),
      prisma.giftVoucher.update({ where: { token }, data: { paymentSessionId: paymentSession.payment_session_id } }),
    ])

    return NextResponse.json({ token, code, paymentUrl: paymentSession.payment_link_url }, { status: 201 })
  } catch (error) {
    if (createdSaleId) {
      await prisma.$transaction([
        prisma.posSale.updateMany({ where: { id: createdSaleId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } }),
        prisma.giftVoucher.updateMany({ where: { purchaseSaleId: createdSaleId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
      ]).catch((cleanupError) => console.error("Could not cancel failed gift voucher checkout", { cleanupError, createdSaleId }))
    }
    const configError = error instanceof XenditConfigurationError
    console.error("Could not start gift voucher checkout", { error, xenditStatus: error instanceof XenditApiError ? error.status : undefined })
    return NextResponse.json(
      { error: configError ? "Online payment is not configured yet." : "Gift voucher checkout could not be started. Please try again." },
      { status: configError ? 503 : 502 },
    )
  }
}
