import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder")

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
  const data = await req.json()
  const session = await auth()

  const { contact, pieces, preferences } = data

  if (!contact?.name || !contact?.email) {
    return NextResponse.json({ error: "Missing required contact fields" }, { status: 400 })
  }

  // Create order in database
  const order = await prisma.order.create({
    data: {
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone || null,
      contactLocation: contact.location || "",
      pieces: JSON.stringify(pieces),
      preferences: JSON.stringify(preferences),
      userId: session?.user?.id || null,
    },
  })

  // Send email notification via Resend (keep existing behavior)
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    await resend.emails.send({
      from: fromEmail,
      to: "backusceramics@gmail.com",
      reply_to: contact.email,
      subject: `NEW ORDER INQUIRY: ${contact.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>New Order Inquiry</h2>
          <p><strong>Name:</strong> ${contact.name}</p>
          <p><strong>Email:</strong> ${contact.email}</p>
          <p><strong>Location:</strong> ${contact.location}</p>
          <p><strong>Pieces:</strong> ${pieces.length} items</p>
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
