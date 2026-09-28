import { randomBytes } from "crypto"

export const GIFT_VOUCHER_TYPES = ["CLASS", "CASH"] as const
export const GIFT_VOUCHER_CLASS_DAYS = [1, 3, 6] as const
export const MIN_CASH_GIFT_VOUCHER_IDR = 100_000
export const MAX_CASH_GIFT_VOUCHER_IDR = 100_000_000
export const MAX_GIFT_VOUCHER_PARTICIPANTS = 12

export type GiftVoucherType = (typeof GIFT_VOUCHER_TYPES)[number]
export type GiftVoucherClassDays = (typeof GIFT_VOUCHER_CLASS_DAYS)[number]

export const GIFT_VOUCHER_CLASS_PACKAGES: Record<GiftVoucherClassDays, { title: string; unitPrice: number }> = {
  1: { title: "One Day Ceramics Class", unitPrice: 650_000 },
  3: { title: "Three Day Ceramics Workshop", unitPrice: 2_500_000 },
  6: { title: "Six Day Ceramics Workshop", unitPrice: 3_500_000 },
}

export function isGiftVoucherClassDays(value: number): value is GiftVoucherClassDays {
  return GIFT_VOUCHER_CLASS_DAYS.includes(value as GiftVoucherClassDays)
}

export function calculateClassGiftVoucherPrice(days: GiftVoucherClassDays, participants: number) {
  return GIFT_VOUCHER_CLASS_PACKAGES[days].unitPrice * participants
}

export function createGiftVoucherCode() {
  return `BACKUS-${randomBytes(5).toString("hex").toUpperCase()}`
}

export function createGiftVoucherToken() {
  return randomBytes(24).toString("base64url")
}

export function normalizeGiftVoucherLookup(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  try {
    const url = new URL(raw)
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").trim()
  } catch {
    return raw.toUpperCase().replace(/\s+/g, "")
  }
}

export function giftVoucherQrPayload(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/gift-cards/v/${encodeURIComponent(token)}`
}

export function giftVoucherLockKey(voucherId: string) {
  return `gift:${voucherId}`
}

export function getGiftVoucherTitle(voucher: { type: string; classDays?: number | null; participants?: number }) {
  if (voucher.type === "CASH") return "Backus Ceramics Cash Gift Voucher"
  const days = Number(voucher.classDays || 1) as GiftVoucherClassDays
  const packageTitle = GIFT_VOUCHER_CLASS_PACKAGES[days]?.title || "Ceramics Class"
  const participants = Math.max(Number(voucher.participants || 1), 1)
  return `${packageTitle} for ${participants} ${participants === 1 ? "person" : "people"}`
}

export function getGiftVoucherBalanceLabel(voucher: {
  type: string
  remainingAmount: number
  remainingClassDays: number
  participants: number
}) {
  if (voucher.type === "CASH") return `${voucher.remainingAmount}`
  return `${voucher.remainingClassDays} ${voucher.remainingClassDays === 1 ? "day" : "days"} remaining for ${voucher.participants} ${voucher.participants === 1 ? "person" : "people"}`
}
