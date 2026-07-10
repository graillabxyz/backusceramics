import { createHmac, timingSafeEqual } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import { canUsePos } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const POS_OPERATOR_COOKIE = "bc_pos_operator"

interface PosOperatorCookiePayload {
  operatorId: string
  unlockedAt: number
  expiresAt: number
}

function getPosOperatorSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  )
}

function signValue(value: string) {
  const secret = getPosOperatorSecret()
  if (!secret) {
    throw new Error("POS operator sessions require AUTH_SECRET, NEXTAUTH_SECRET, or a database URL")
  }

  return createHmac("sha256", secret).update(value).digest("base64url")
}

function safeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function parsePosOperatorCookie(value?: string | null): PosOperatorCookiePayload | null {
  if (!value) return null

  const [payloadValue, signature] = value.split(".")
  if (!payloadValue || !signature) return null

  let expectedSignature = ""
  try {
    expectedSignature = signValue(payloadValue)
  } catch (error) {
    console.error("POS operator session signing is not configured", error)
    return null
  }

  if (!safeEqualString(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadValue, "base64url").toString("utf8")) as Partial<PosOperatorCookiePayload>
    if (
      typeof payload.operatorId !== "string" ||
      typeof payload.unlockedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return {
      operatorId: payload.operatorId,
      unlockedAt: payload.unlockedAt,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function setPosOperatorCookie(response: NextResponse, operatorId: string, maxAgeSeconds: number) {
  const now = Date.now()
  const payload: PosOperatorCookiePayload = {
    operatorId,
    unlockedAt: now,
    expiresAt: now + maxAgeSeconds * 1000,
  }
  const payloadValue = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = signValue(payloadValue)

  response.cookies.set(POS_OPERATOR_COOKIE, `${payloadValue}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  })
}

export function clearPosOperatorCookie(response: NextResponse) {
  response.cookies.set(POS_OPERATOR_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export async function getPosOperatorFromRequest(req: NextRequest) {
  const payload = parsePosOperatorCookie(req.cookies.get(POS_OPERATOR_COOKIE)?.value)
  if (!payload) return null

  const operator = await prisma.user.findUnique({
    where: { id: payload.operatorId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      posPinHash: true,
    },
  })

  if (!operator || !operator.posPinHash || !canUsePos(operator.role)) return null

  return {
    id: operator.id,
    name: operator.name,
    email: operator.email,
    role: operator.role,
  }
}
