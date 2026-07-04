import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isFullAdminRole } from "@/lib/permissions"
import { createClient } from "@supabase/supabase-js"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

function getExtension(filename: string) {
  return path.extname(filename).toLowerCase() || ".jpg"
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
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    })

    if (createBucketError && !createBucketError.message.toLowerCase().includes("already exists")) {
      throw new Error(`Could not create storage bucket "${bucket}": ${createBucketError.message}`)
    }
  }

  const filename = `products/${getUploadFilename(file)}`
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
    contentType: file.type || "image/jpeg",
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

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 })
  }

  if (file.size > 8 * 1024 * 1024) {
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

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })

  // Generate unique filename
  const filename = getUploadFilename(file)
  const filepath = path.join(uploadsDir, filename)

  await writeFile(filepath, buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
