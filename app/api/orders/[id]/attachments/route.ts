import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { auth } from "@/lib/auth"
import { parseOrderAttachments } from "@/lib/order-attachments"
import { isFullAdminRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, cleanString, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

export const runtime = "nodejs"

const MAX_PDF_SIZE = 12 * 1024 * 1024
const ORDER_DOCUMENT_BUCKET = process.env.SUPABASE_ORDER_DOCUMENTS_BUCKET || "order-documents"

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function cleanDisplayName(filename: string) {
  const basename = path.basename(filename).replace(/[\u0000-\u001f\u007f]/g, " ")
  return cleanString(basename, 160) || "order-document.pdf"
}

function isPdf(file: File, buffer: Buffer) {
  const mimeType = file.type.toLowerCase()
  const extension = path.extname(file.name).toLowerCase()
  return extension === ".pdf"
    && (!mimeType || mimeType === "application/pdf")
    && buffer.length >= 5
    && buffer.subarray(0, 5).toString("ascii") === "%PDF-"
}

async function ensurePrivateDocumentBucket(supabase: NonNullable<ReturnType<typeof getStorageClient>>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) throw new Error(`Could not inspect document storage: ${listError.message}`)

  if (!buckets?.some((bucket) => bucket.name === ORDER_DOCUMENT_BUCKET)) {
    const { error } = await supabase.storage.createBucket(ORDER_DOCUMENT_BUCKET, {
      public: false,
      fileSizeLimit: MAX_PDF_SIZE,
      allowedMimeTypes: ["application/pdf"],
    })
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new Error(`Could not create document storage: ${error.message}`)
    }
    return
  }

  const { error } = await supabase.storage.updateBucket(ORDER_DOCUMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_PDF_SIZE,
    allowedMimeTypes: ["application/pdf"],
  })
  if (error) throw new Error(`Could not secure document storage: ${error.message}`)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimit = checkRateLimit(req, { key: "order-pdf-upload", limit: 20, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many document uploads. Please wait a few minutes and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_PDF_SIZE + 64 * 1024)) {
    return NextResponse.json({ error: "PDF must be smaller than 12MB" }, { status: 413 })
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No PDF provided" }, { status: 400 })
  if (file.size > MAX_PDF_SIZE) return NextResponse.json({ error: "PDF must be smaller than 12MB" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!isPdf(file, buffer)) {
    return NextResponse.json({ error: "Only valid PDF documents are allowed" }, { status: 400 })
  }

  const supabase = getStorageClient()
  if (!supabase) {
    return NextResponse.json({ error: "Private document storage is not configured" }, { status: 503 })
  }

  try {
    await ensurePrivateDocumentBucket(supabase)
    const storagePath = `orders/${id}/${Date.now()}-${crypto.randomUUID()}.pdf`
    const { error } = await supabase.storage.from(ORDER_DOCUMENT_BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({
      name: cleanDisplayName(file.name),
      path: storagePath,
      size: buffer.length,
      mimeType: "application/pdf",
    })
  } catch (error) {
    console.error("Custom order PDF upload failed", { orderId: id, error })
    return NextResponse.json({ error: "PDF upload failed. Please try again." }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const requestedPath = cleanString(req.nextUrl.searchParams.get("path"), 500)
  if (!requestedPath) return NextResponse.json({ error: "Document path is required" }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      userId: true,
      updates: { select: { attachments: true } },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (!isFullAdminRole(session.user.role) && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const attachment = order.updates
    .flatMap((update) => parseOrderAttachments(update.attachments))
    .find((item) => item.path === requestedPath)
  if (!attachment || !attachment.path.startsWith(`orders/${id}/`)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const supabase = getStorageClient()
  if (!supabase) return NextResponse.json({ error: "Document storage is not configured" }, { status: 503 })

  const { data, error } = await supabase.storage
    .from(ORDER_DOCUMENT_BUCKET)
    .createSignedUrl(attachment.path, 60, { download: attachment.name })
  if (error || !data?.signedUrl) {
    console.error("Custom order PDF download signing failed", { orderId: id, path: attachment.path, error })
    return NextResponse.json({ error: "Document could not be opened" }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
