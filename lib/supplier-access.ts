import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canManageSupplierAccounts, canUsePos } from "@/lib/permissions"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"

export async function authorizeSupplierAccess(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return { error: "Unauthorized", status: 401 as const }
  }

  if (canManageSupplierAccounts(session.user.role)) {
    return {
      session,
      actorId: session.user.id,
      canEditSuppliers: true as const,
      operatorId: null,
    }
  }

  const operator = await getPosOperatorFromRequest(req)
  if (!operator) {
    return {
      error: "Unlock the POS with a cashier PIN to use supplier accounts.",
      status: 423 as const,
    }
  }

  return {
    session,
    actorId: operator.id,
    canEditSuppliers: false as const,
    operatorId: operator.id,
  }
}

export function refreshSupplierAccess(response: NextResponse, access: { operatorId: string | null }) {
  if (access.operatorId) setPosOperatorCookie(response, access.operatorId, POS_PIN_LOCK_SECONDS)
  return response
}
