import { randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { PAYMENT_LINK_NOTE, getPaymentLinkStatus, parsePaymentLinkInput } from "@/lib/custom-payment-links"
import { canManagePromotions } from "@/lib/permissions"
import { formatPrice } from "@/lib/pos-catalog"
import { prisma } from "@/lib/prisma"
import { getTrustedRequestOrigin } from "@/lib/request-origin"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"
import {
  createXenditCustomerReference,
  createXenditPaymentSession,
  XenditApiError,
  XenditConfigurationError,
} from "@/lib/xendit"

export const runtime = "nodejs"

const MAX_BODY_BYTES = 16 * 1024

async function requirePaymentLinkAdmin() {
  const session = await auth()
  return session && canManagePromotions(session.user.role) ? session : null
}

function safeCustomerName(value?: string | null) {
  return String(value || "Backus Customer")
    .replace(/[^\p{L}\p{N} .'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50) || "Backus Customer"
}

export async function GET() {
  const session = await requirePaymentLinkAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const links = await prisma.customPaymentLink.findMany({
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      sales: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          paymentSessionId: true,
          receiptSentAt: true,
          createdAt: true,
        },
      },
    },
  })

  const normalized = links.map((link) => ({ ...link, displayStatus: getPaymentLinkStatus(link) }))
  return NextResponse.json({
    links: normalized,
    summary: {
      active: normalized.filter((link) => link.displayStatus === "ACTIVE").length,
      paid: normalized.filter((link) => link.displayStatus === "PAID").length,
      paidTotal: normalized
        .filter((link) => link.displayStatus === "PAID")
        .reduce((sum, link) => sum + link.amount, 0),
      opened: normalized.filter((link) => Boolean(link.openedAt)).length,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await requirePaymentLinkAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateLimit = checkRateLimit(req, { key: `admin-payment-link:${session.user.id}`, limit: 20, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many payment links were created. Wait a moment and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }
  if (isRequestBodyTooLarge(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "Payment link request is too large." }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Payment link request is invalid." }, { status: 400 })
  }
  const parsed = parsePaymentLinkInput(data as Record<string, unknown>)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const token = randomBytes(24).toString("base64url")
  const reference = `paylink_${Date.now()}_${randomBytes(4).toString("hex")}`
  const expiresAt = new Date(Date.now() + parsed.values.expiresInDays * 24 * 60 * 60 * 1000)
  const category = parsed.values.purpose.replaceAll("_", " ")
  let linkId = ""
  let saleId = ""

  try {
    const created = await prisma.$transaction(async (tx) => {
      const link = await tx.customPaymentLink.create({
        data: {
          token,
          title: parsed.values.title,
          description: parsed.values.description,
          amount: parsed.values.amount,
          purpose: parsed.values.purpose,
          customerName: parsed.values.customerName,
          customerEmail: parsed.values.customerEmail,
          customerPhone: parsed.values.customerPhone,
          checkoutUrl: "",
          expiresAt,
          createdById: session.user.id,
        },
      })
      const sale = await tx.posSale.create({
        data: {
          operatorId: session.user.id,
          paymentLinkId: link.id,
          subtotal: parsed.values.amount,
          total: parsed.values.amount,
          status: "PENDING_PAYMENT",
          paymentMethod: "ONLINE",
          paymentReference: reference,
          receiptEmail: parsed.values.customerEmail,
          fulfillmentMethod: "CUSTOM_PAYMENT",
          notes: `${PAYMENT_LINK_NOTE} ${parsed.values.purpose}`,
          items: {
            create: {
              nameSnapshot: parsed.values.title,
              skuSnapshot: `LINK-${link.id.slice(-8).toUpperCase()}`,
              categorySnapshot: category,
              unitPrice: parsed.values.amount,
              quantity: 1,
              subtotal: parsed.values.amount,
              lineTotal: parsed.values.amount,
            },
          },
        },
      })
      return { link, sale }
    })
    linkId = created.link.id
    saleId = created.sale.id

    const origin = getTrustedRequestOrigin(req)
    const paymentSession = await createXenditPaymentSession({
      reference_id: reference,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: parsed.values.amount,
      currency: "IDR",
      country: "ID",
      description: `${parsed.values.title} - ${formatPrice(parsed.values.amount)}`,
      allow_save_payment_method: "DISABLED",
      locale: "en",
      customer: {
        reference_id: createXenditCustomerReference(parsed.values.customerEmail || parsed.values.customerName || linkId, reference),
        type: "INDIVIDUAL",
        email: parsed.values.customerEmail || undefined,
        individual_detail: { given_names: safeCustomerName(parsed.values.customerName) },
      },
      items: [{
        reference_id: linkId,
        type: parsed.values.purpose === "SHIPPING" || parsed.values.purpose === "DEPOSIT" ? "FEE" : "PHYSICAL_PRODUCT",
        name: parsed.values.title,
        net_unit_amount: parsed.values.amount,
        quantity: 1,
        category,
      }],
      metadata: {
        pos_sale_id: saleId,
        pos_payment_reference: reference,
        custom_payment_link_id: linkId,
        checkout_channel: "custom_payment_link",
      },
      success_return_url: `${origin}/pay/${token}?payment=success`,
      cancel_return_url: `${origin}/pay/${token}?payment=cancelled`,
      expires_at: expiresAt.toISOString(),
    })

    const link = await prisma.$transaction(async (tx) => {
      await tx.posSale.update({ where: { id: saleId }, data: { paymentSessionId: paymentSession.payment_session_id } })
      return tx.customPaymentLink.update({
        where: { id: linkId },
        data: { checkoutUrl: paymentSession.payment_link_url },
        include: { sales: { select: { status: true } } },
      })
    })

    await recordAnalyticsEvent({
      type: "custom_payment_link_created",
      userId: session.user.id,
      source: "admin",
      value: link.amount,
      currency: "IDR",
      metadata: { linkId: link.id, saleId, purpose: link.purpose },
    }, req)

    return NextResponse.json({
      link: { ...link, displayStatus: getPaymentLinkStatus(link) },
      publicUrl: `${origin}/pay/${token}`,
    }, { status: 201 })
  } catch (error) {
    if (saleId || linkId) {
      await prisma.$transaction(async (tx) => {
        if (saleId) await tx.posSale.deleteMany({ where: { id: saleId } })
        if (linkId) await tx.customPaymentLink.deleteMany({ where: { id: linkId } })
      }).catch((cleanupError) => console.error("Could not clean up failed payment link", { cleanupError, saleId, linkId }))
    }
    const isXenditError = error instanceof XenditApiError
    const isConfigError = error instanceof XenditConfigurationError
    console.error("Could not create custom payment link", {
      error,
      xenditStatus: isXenditError ? error.status : undefined,
      xenditCode: isXenditError ? error.xenditCode : undefined,
      xenditResponse: isXenditError ? error.responseBody : undefined,
    })
    return NextResponse.json({
      error: isConfigError
        ? "Online payments are not configured right now."
        : "Could not create the secure payment link. Please try again shortly.",
    }, { status: isXenditError ? 502 : 500 })
  }
}
