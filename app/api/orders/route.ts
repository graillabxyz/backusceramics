import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { Resend } from "resend"
import {
  checkRateLimit,
  cleanString,
  escapeHtml,
  isRequestBodyTooLarge,
  isValidEmailAddress,
  rateLimitHeaders,
  safeHeaderValue,
} from "@/lib/server-security"

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder")
const MAX_ORDER_BODY_BYTES = 128 * 1024
const CUSTOM_ORDER_MINIMUM_IDR = 3_500_000

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Admin gets all orders, regular users get only their own
  if (isFullAdminRole(session.user.role)) {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { updates: { orderBy: { createdAt: "desc" } } },
    })
    return NextResponse.json(orders)
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { updates: { orderBy: { createdAt: "desc" } } },
  })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "order-inquiry", limit: 3, windowMs: 30 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many order requests. Please wait and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_ORDER_BODY_BYTES)) {
    return NextResponse.json({ error: "Order request is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Order request is not valid JSON" }, { status: 400 })
  const session = await auth()

  const { contact, pieces, preferences } = data
  const contactName = cleanString(contact?.name, 160)
  const contactEmail = safeHeaderValue(contact?.email, 254)
  const contactPhone = cleanString(contact?.phone, 80)
  const contactLocation = cleanString(contact?.location, 180)
  const orderPieces = Array.isArray(pieces) ? pieces.slice(0, 50) : []
  const orderPreferences = preferences && typeof preferences === "object" ? preferences : {}
  const minimumOrderIdr = CUSTOM_ORDER_MINIMUM_IDR

  if (!contactName || !isValidEmailAddress(contactEmail)) {
    return NextResponse.json({ error: "Missing required contact fields" }, { status: 400 })
  }

  // Create order in database
  const order = await prisma.order.create({
    data: {
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      contactLocation,
      pieces: JSON.stringify(orderPieces),
      preferences: JSON.stringify(orderPreferences),
      userId: session?.user?.id || null,
    },
  })

  // Send email notification via Resend (keep existing behavior)
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    await resend.emails.send({
      from: fromEmail,
      to: "backusceramics@gmail.com",
      replyTo: contactEmail,
      subject: `NEW ORDER INQUIRY: ${safeHeaderValue(contactName, 100)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>New Order Inquiry</h2>
          <p><strong>Name:</strong> ${escapeHtml(contactName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(contactEmail)}</p>
          <p><strong>Location:</strong> ${escapeHtml(contactLocation || "Not provided")}</p>
          <p><strong>Pieces:</strong> ${orderPieces.length} items</p>
          <p><strong>Minimum custom order:</strong> Rp ${minimumOrderIdr.toLocaleString("id-ID")}</p>
          <p>View full details in the <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/orders/${order.id}">admin dashboard</a>.</p>
        </div>
      `,
    })
  } catch (emailErr) {
    console.error("Email notification failed:", emailErr)
    // Don't fail the order creation if email fails
  }

  return NextResponse.json({ success: true, orderId: order.id })
}
