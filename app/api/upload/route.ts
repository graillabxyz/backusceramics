import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isFullAdminRole } from "@/lib/permissions"
import { createClient } from "@supabase/supabase-js"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import sharp from "sharp"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

export const runtime = "nodejs"

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

interface DetectedImageType {
  contentType: string
  extension: string
}

function getExtension(filename: string) {
  return path.extname(filename).toLowerCase() || ".jpg"
}

function isAllowedImage(file: File) {
  const normalizedType = file.type.toLowerCase()
  const ext = getExtension(file.name)
  const hasAllowedType = normalizedType ? ALLOWED_IMAGE_MIME_TYPES.includes(normalizedType) : true

  return ALLOWED_IMAGE_EXTENSIONS.has(ext) && hasAllowedType
}

function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: ".jpg" }
  }

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: "image/png", extension: ".png" }
  }

  const header = buffer.subarray(0, 12).toString("ascii")
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return { contentType: "image/gif", extension: ".gif" }
  }

  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: ".webp" }
  }

  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase()
    if (brand === "avif" || brand === "avis") {
      return { contentType: "image/avif", extension: ".avif" }
    }
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { contentType: "image/heic", extension: ".heic" }
    }
  }

  return null
}

function getUploadFilename(extension: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
}

async function uploadToSupabaseStorage(buffer: Buffer) {
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
      allowedMimeTypes: ["image/webp"],
    })

    if (createBucketError && !createBucketError.message.toLowerCase().includes("already exists")) {
      throw new Error(`Could not create storage bucket "${bucket}": ${createBucketError.message}`)
    }
  } else {
    const { error: updateBucketError } = await supabase.storage.updateBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_UPLOAD_SIZE,
      allowedMimeTypes: ["image/webp"],
    })

    if (updateBucketError) {
      console.warn(`Could not update storage bucket "${bucket}" image settings: ${updateBucketError.message}`)
    }
  }

  const filename = `products/${getUploadFilename(".webp")}`
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
    contentType: "image/webp",
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

  if (isRequestBodyTooLarge(req, MAX_UPLOAD_SIZE + 64 * 1024)) {
    return NextResponse.json({ error: "Image must be smaller than 8MB" }, { status: 413 })
  }

  const rateLimit = checkRateLimit(req, { key: "product-image-upload", limit: 20, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many image uploads. Please wait a few minutes and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
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
  const detectedType = detectImageType(buffer)
  if (!detectedType) {
    return NextResponse.json({ error: "The uploaded file is not a supported image" }, { status: 400 })
  }

  let optimizedBuffer: Buffer
  let optimizedInfo: { width: number; height: number; size: number }
  try {
    const optimized = await sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: "none",
    })
      .autoOrient()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4, smartSubsample: true })
      .toBuffer({ resolveWithObject: true })

    optimizedBuffer = optimized.data
    optimizedInfo = {
      width: optimized.info.width,
      height: optimized.info.height,
      size: optimized.info.size,
    }
  } catch (error) {
    console.error("Product image processing failed", { error, detectedType, originalSize: buffer.length })
    return NextResponse.json(
      { error: "That image could not be processed. Try another image or export it as JPG, PNG, or WebP." },
      { status: 400 }
    )
  }

  try {
    const storageUrl = await uploadToSupabaseStorage(optimizedBuffer)
    if (storageUrl) {
      return NextResponse.json({
        url: storageUrl,
        format: "webp",
        width: optimizedInfo.width,
        height: optimizedInfo.height,
        size: optimizedInfo.size,
        originalSize: buffer.length,
        savedBytes: Math.max(buffer.length - optimizedInfo.size, 0),
      })
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
  const filename = getUploadFilename(".webp")
  const filepath = path.join(uploadsDir, filename)

  await writeFile(filepath, optimizedBuffer)

  return NextResponse.json({
    url: `/uploads/${filename}`,
    format: "webp",
    width: optimizedInfo.width,
    height: optimizedInfo.height,
    size: optimizedInfo.size,
    originalSize: buffer.length,
    savedBytes: Math.max(buffer.length - optimizedInfo.size, 0),
  })
}
