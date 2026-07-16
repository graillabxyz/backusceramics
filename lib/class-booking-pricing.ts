import type { Workshop } from "./classes-data"

export type ClassBookingOption = "standard" | "parent-child"

export interface ClassBookingPricing {
  option: ClassBookingOption
  label: string
  bookingUnits: number
  participants: number
  unitPrice: number
  total: number
}

export function normalizeClassBookingOption(workshop: Workshop, value: unknown): ClassBookingOption {
  if (workshop.id === "kids-workshop" && workshop.priceAlt && value === "parent-child") {
    return "parent-child"
  }
  return "standard"
}

export function getClassBookingPricing(
  workshop: Workshop,
  option: ClassBookingOption,
  bookingUnits: number
): ClassBookingPricing | null {
  if (!Number.isInteger(bookingUnits) || bookingUnits < 1) return null

  if (option === "parent-child") {
    if (workshop.id !== "kids-workshop" || !workshop.priceAlt) return null
    return {
      option,
      label: workshop.priceAlt.label,
      bookingUnits,
      participants: bookingUnits * 2,
      unitPrice: workshop.priceAlt.price,
      total: workshop.priceAlt.price * bookingUnits,
    }
  }

  return {
    option: "standard",
    label: workshop.id === "kids-workshop" ? "Kids only" : workshop.title,
    bookingUnits,
    participants: bookingUnits,
    unitPrice: workshop.price,
    total: workshop.price * bookingUnits,
  }
}
