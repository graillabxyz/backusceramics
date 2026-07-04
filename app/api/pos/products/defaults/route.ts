import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canUsePos } from "@/lib/permissions"
import { syncDefaultPosProducts } from "@/lib/pos-default-sync"

export async function POST() {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await syncDefaultPosProducts({ createdBy: session.user.id })

  return NextResponse.json({ ok: true, ...result })
}
