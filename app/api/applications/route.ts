import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"

const MAX_APPLICATION_BODY_BYTES = 64 * 1024

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isFullAdminRole(session.user.role)) {
    const apps = await prisma.residencyApplication.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(apps)
  }

  const apps = await prisma.residencyApplication.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(apps)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Must be signed in to apply" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_APPLICATION_BODY_BYTES)) {
    return NextResponse.json({ error: "Application is too large" }, { status: 413 })
  }

  const data = await req.json()

  const programId = cleanString(data.programId, 120)
  if (!programId) {
    return NextResponse.json({ error: "Program ID is required" }, { status: 400 })
  }

  const application = await prisma.residencyApplication.create({
    data: {
      programId,
      userId: session.user.id,
      experience: cleanString(data.experience, 4000) || null,
      goals: cleanString(data.goals, 4000) || null,
      preferredDate: cleanString(data.preferredDate, 120) || null,
      notes: cleanString(data.notes, 4000) || null,
      contactName: session.user.name || cleanString(data.contactName, 160) || "",
      contactEmail: session.user.email || safeHeaderValue(data.contactEmail, 254) || "",
      contactPhone: cleanString(data.contactPhone, 80) || null,
    },
  })

  return NextResponse.json(application)
}
