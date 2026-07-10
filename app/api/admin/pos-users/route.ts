import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canManageAdmins, isOwnerEmail, normalizeRole, type AppRole } from "@/lib/permissions"
import { hashPosPin, isValidPosPin, verifyPosPin } from "@/lib/pos-pin"
import { prisma } from "@/lib/prisma"

const posCapableRoles: AppRole[] = ["OWNER", "ADMIN", "MANAGER", "POS_OPERATOR"]

function serializePosUser(user: {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  posPinHash: string | null
  posPinSetAt: Date | null
  updatedAt: Date
  _count?: { posSales: number }
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    hasPosPin: Boolean(user.posPinHash),
    posPinSetAt: user.posPinSetAt,
    updatedAt: user.updatedAt,
    posSales: user._count?.posSales || 0,
  }
}

async function findDuplicatePinOwner(pin: string, excludeUserId?: string) {
  const candidates = await prisma.user.findMany({
    where: {
      posPinHash: { not: null },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      posPinHash: true,
    },
  })

  for (const candidate of candidates) {
    if (await verifyPosPin(pin, candidate.posPinHash)) {
      return candidate
    }
  }

  return null
}

export async function GET() {
  const session = await auth()
  if (!session || !canManageAdmins(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { role: { in: posCapableRoles } },
    orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      posPinHash: true,
      posPinSetAt: true,
      updatedAt: true,
      _count: { select: { posSales: true } },
    },
  })

  return NextResponse.json({ users: users.map(serializePosUser) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canManageAdmins(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const pin = typeof body.pin === "string" ? body.pin.trim() : ""
  if (!isValidPosPin(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 6 numbers." }, { status: 400 })
  }

  const normalizedRole = normalizeRole(body.role)
  const role = posCapableRoles.includes(normalizedRole) && normalizedRole !== "OWNER"
    ? normalizedRole
    : "POS_OPERATOR"
  const posPinSetAt = new Date()

  if (typeof body.userId === "string" && body.userId && !body.userId.startsWith("auth:")) {
    const targetUser = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, email: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const duplicatePinOwner = await findDuplicatePinOwner(pin, targetUser.id)
    if (duplicatePinOwner) {
      return NextResponse.json(
        { error: `That PIN is already assigned to ${duplicatePinOwner.name || duplicatePinOwner.email}. Choose a different 6 digit PIN.` },
        { status: 409 }
      )
    }

    const pinHash = await hashPosPin(pin)
    const nextRole = isOwnerEmail(targetUser.email) ? "OWNER" : role
    const user = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        role: nextRole,
        posPinHash: pinHash,
        posPinSetAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        posPinHash: true,
        posPinSetAt: true,
        updatedAt: true,
        _count: { select: { posSales: true } },
      },
    })

    return NextResponse.json({ user: serializePosUser(user) })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Choose an existing user or enter a valid email." }, { status: 400 })
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  const duplicatePinOwner = await findDuplicatePinOwner(pin, existingUser?.id)
  if (duplicatePinOwner) {
    return NextResponse.json(
      { error: `That PIN is already assigned to ${duplicatePinOwner.name || duplicatePinOwner.email}. Choose a different 6 digit PIN.` },
      { status: 409 }
    )
  }

  const pinHash = await hashPosPin(pin)
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: isOwnerEmail(email) ? "OWNER" : role,
      posPinHash: pinHash,
      posPinSetAt,
    },
    update: {
      name: name || undefined,
      role: isOwnerEmail(email) ? "OWNER" : role,
      posPinHash: pinHash,
      posPinSetAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      posPinHash: true,
      posPinSetAt: true,
      updatedAt: true,
      _count: { select: { posSales: true } },
    },
  })

  return NextResponse.json({ user: serializePosUser(user) }, { status: 201 })
}
