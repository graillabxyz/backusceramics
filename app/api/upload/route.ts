import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isFullAdminRole } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })

  // Generate unique filename
  const ext = path.extname(file.name) || ".jpg"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  const filepath = path.join(uploadsDir, filename)

  await writeFile(filepath, buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
