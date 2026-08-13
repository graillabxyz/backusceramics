"use client"

import { useEffect, useState } from "react"
import Image, { type ImageProps } from "next/image"
import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductImageProps extends Omit<ImageProps, "src" | "onError" | "unoptimized"> {
  src: string
  fallbackLabel?: string
  fallbackClassName?: string
}

export function ProductImage({
  src,
  alt,
  fallbackLabel = "Image unavailable",
  fallbackClassName,
  ...props
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted px-4 text-center text-sm text-muted-foreground",
          fallbackClassName
        )}
        role="img"
        aria-label={alt || fallbackLabel}
      >
        <ImageIcon className="h-6 w-6" aria-hidden="true" />
        <span>{fallbackLabel}</span>
      </div>
    )
  }

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized
      onError={() => setFailed(true)}
    />
  )
}
