export interface OrderAttachment {
  name: string
  path: string
  size: number
  mimeType: "application/pdf"
}

export function parseOrderAttachments(value: string | null | undefined): OrderAttachment[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is OrderAttachment => (
      Boolean(item)
      && typeof item.name === "string"
      && typeof item.path === "string"
      && typeof item.size === "number"
      && item.mimeType === "application/pdf"
    ))
  } catch {
    return []
  }
}

export function parseOrderImageUrls(value: string | null | undefined): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

export function formatAttachmentSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "PDF"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
