import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isFullAdminRole } from "@/lib/permissions"
import { createClient } from "@supabase/supabase-js"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const MAX_UPLOAD_SIZE = 8 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".avif"])

function getExtension(filename: string) {
  return path.extname(filename).toLowerCase() || ".jpg"
}

function getContentType(file: File) {
  const normalizedType = file.type.toLowerCase()
  if (ALLOWED_IMAGE_MIME_TYPES.includes(normalizedType)) return normalizedType

  const ext = getExtension(file.name)
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  if (ext === ".heic") return "image/heic"
  if (ext === ".heif") return "image/heif"
  if (ext === ".avif") return "image/avif"
  return "image/jpeg"
}

function isAllowedImage(file: File) {
  const normalizedType = file.type.toLowerCase()
  const ext = getExtension(file.name)
  const hasAllowedType = normalizedType ? ALLOWED_IMAGE_MIME_TYPES.includes(normalizedType) : true

  return ALLOWED_IMAGE_EXTENSIONS.has(ext) && hasAllowedType
}

function getUploadFilename(file: File) {
  const ext = getExtension(file.name)
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
}

async function uploadToSupabaseStorage(file: File, buffer: Buffer) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images"

  if (!supabaseUrl || !serviceRoleKey) return null

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets()
  if (bucketListError) {
    throw new Error(`Could not inspect storage buckets: ${bucketListError.message}`)
  }

  if (!buckets?.some((item) => item.name === bucket)) {
    const { error: createBucketError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_UPLOAD_SIZE,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    })

    if (createBucketError && !createBucketError.message.toLowerCase().includes("already exists")) {
      throw new Error(`Could not create storage bucket "${bucket}": ${createBucketError.message}`)
    }
  } else {
    const { error: updateBucketError } = await supabase.storage.updateBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_UPLOAD_SIZE,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    })

    if (updateBucketError) {
      console.warn(`Could not update storage bucket "${bucket}" image settings: ${updateBucketError.message}`)
    }
  }

  const filename = `products/${getUploadFilename(file)}`
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
    contentType: getContentType(file),
    upsert: false,
  })

  if (error) {
    throw new Error(`Could not upload to storage bucket "${bucket}": ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
  return data.publicUrl
}

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

  if (!isAllowedImage(file)) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Image must be smaller than 8MB" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  try {
    const storageUrl = await uploadToSupabaseStorage(file, buffer)
    if (storageUrl) {
      return NextResponse.json({ url: storageUrl })
    }
  } catch (error) {
    console.error("Supabase product image upload failed", error)
    return NextResponse.json(
      {
        error: "Image upload failed",
        code: "SUPABASE_STORAGE_UPLOAD_FAILED",
        detail: error instanceof Error ? error.message : "Unknown storage error",
      },
      { status: 500 }
    )
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Image storage is not configured",
        code: "SUPABASE_STORAGE_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })

  // Generate unique filename
  const filename = getUploadFilename(file)
  const filepath = path.join(uploadsDir, filename)

  await writeFile(filepath, buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
