import { getShippingDestination } from "@/lib/shipping-destinations"

export interface ShippableProduct {
  id: string
  name: string
  category: string
  quantity: number
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

export interface ShippingQuote {
  countryCode: string
  countryName: string
  service: string
  amount: number
  currency: "IDR"
  actualWeightKg: number
  volumetricWeightKg: number
  chargeableWeightKg: number
  packageLengthCm: number
  packageWidthCm: number
  packageHeightCm: number
  estimatedDelivery: string
  usedProductDefaults: boolean
  disclaimer: string
}

interface ProductPackingDefaults {
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

const DEFAULTS_BY_CATEGORY: Record<string, ProductPackingDefaults> = {
  CUPS: { weightGrams: 450, lengthCm: 10, widthCm: 10, heightCm: 12 },
  VASES: { weightGrams: 1400, lengthCm: 20, widthCm: 20, heightCm: 28 },
  LAMPS: { weightGrams: 2200, lengthCm: 28, widthCm: 28, heightCm: 35 },
  TABLEWARE: { weightGrams: 800, lengthCm: 24, widthCm: 24, heightCm: 8 },
  OTHER: { weightGrams: 1200, lengthCm: 22, widthCm: 22, heightCm: 22 },
}

const SOUTHEAST_ASIA = new Set(["BN", "MY", "PH", "SG", "TH", "VN"])
const AUSTRALIA_NZ = new Set(["AU", "NZ"])
const NORTH_AMERICA = new Set(["CA", "MX", "US"])
const EUROPE = new Set([
  "AT", "BE", "CH", "DE", "DK", "ES", "FI", "FR", "GB", "IE", "IT", "NL", "NO", "PL", "PT", "SE",
])

function positiveNumber(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}

function roundHalfKg(value: number) {
  return Math.max(Math.ceil(value * 2) / 2, 0.5)
}

function rateForCountry(countryCode: string) {
  if (countryCode === "ID") return { base: 35_000, perKg: 22_000, packing: 25_000, service: "Pos Indonesia domestic", delivery: "3-10 business days" }
  if (SOUTHEAST_ASIA.has(countryCode)) return { base: 110_000, perKg: 85_000, packing: 35_000, service: "Pos Indonesia international", delivery: "5-14 business days" }
  if (AUSTRALIA_NZ.has(countryCode)) return { base: 150_000, perKg: 100_000, packing: 35_000, service: "Pos Indonesia international", delivery: "7-18 business days" }
  if (EUROPE.has(countryCode)) return { base: 150_000, perKg: 100_000, packing: 35_000, service: "Pos Indonesia international", delivery: "8-21 business days" }
  if (NORTH_AMERICA.has(countryCode)) return { base: 160_000, perKg: 105_000, packing: 35_000, service: "Pos Indonesia international", delivery: "10-24 business days" }
  return { base: 180_000, perKg: 120_000, packing: 35_000, service: "Pos Indonesia international", delivery: "10-28 business days" }
}

export function calculateCeramicShipping(products: ShippableProduct[], countryCode: string): ShippingQuote {
  const destination = getShippingDestination(countryCode)
  if (!destination) throw new Error("Choose a supported shipping destination")
  if (products.length === 0) throw new Error("Shipping needs at least one product")

  let usedProductDefaults = false
  let actualWeightGrams = 350
  let packedVolumeCm3 = 0
  let minimumLengthCm = 0
  let minimumWidthCm = 0
  let minimumHeightCm = 0

  for (const product of products) {
    const defaults = DEFAULTS_BY_CATEGORY[product.category] || DEFAULTS_BY_CATEGORY.OTHER
    const quantity = Math.max(Math.round(product.quantity), 1)
    const hasAllMeasurements = Boolean(product.weightGrams && product.lengthCm && product.widthCm && product.heightCm)
    if (!hasAllMeasurements) usedProductDefaults = true

    const weightGrams = positiveNumber(product.weightGrams, defaults.weightGrams)
    const packedLength = positiveNumber(product.lengthCm, defaults.lengthCm) + 10
    const packedWidth = positiveNumber(product.widthCm, defaults.widthCm) + 10
    const packedHeight = positiveNumber(product.heightCm, defaults.heightCm) + 10

    const [unitLength, unitWidth, unitHeight] = [packedLength, packedWidth, packedHeight].sort((a, b) => b - a)
    actualWeightGrams += quantity * (weightGrams + 180)
    packedVolumeCm3 += quantity * unitLength * unitWidth * unitHeight
    minimumLengthCm = Math.max(minimumLengthCm, unitLength)
    minimumWidthCm = Math.max(minimumWidthCm, unitWidth)
    minimumHeightCm = Math.max(minimumHeightCm, unitHeight)
  }

  // Combine individually cushioned pieces in one carton with a conservative 12% void allowance.
  const cartonVolume = packedVolumeCm3 * 1.12
  const packageLengthCm = Math.ceil(Math.max(minimumLengthCm, Math.cbrt(cartonVolume) * 1.2))
  const remainingFace = cartonVolume / packageLengthCm
  const packageWidthCm = Math.ceil(Math.max(minimumWidthCm, Math.sqrt(remainingFace)))
  const packageHeightCm = Math.ceil(Math.max(minimumHeightCm, remainingFace / packageWidthCm))
  const actualWeightKg = Math.round((actualWeightGrams / 1000) * 100) / 100
  const volumetricDivisor = destination.code === "ID" ? 6000 : 5000
  const volumetricWeightKg = Math.round(((packageLengthCm * packageWidthCm * packageHeightCm) / volumetricDivisor) * 100) / 100
  const chargeableWeightKg = roundHalfKg(Math.max(actualWeightKg, volumetricWeightKg))

  if (chargeableWeightKg > 30) throw new Error("This order is too large for an automatic Pos Indonesia quote. Please contact the studio.")
  if (packageLengthCm + packageWidthCm + packageHeightCm >= 300 || Math.max(packageLengthCm, packageWidthCm, packageHeightCm) >= 150) {
    throw new Error("This order is too large for an automatic Pos Indonesia quote. Please contact the studio.")
  }

  const rate = rateForCountry(destination.code)
  const configuredMultiplier = Number(process.env.SHIPPING_RATE_MULTIPLIER || "1.08")
  const multiplier = Number.isFinite(configuredMultiplier) && configuredMultiplier >= 1 ? configuredMultiplier : 1.08
  const amount = Math.ceil(((rate.base + rate.perKg * chargeableWeightKg + rate.packing) * multiplier) / 5_000) * 5_000

  return {
    countryCode: destination.code,
    countryName: destination.name,
    service: rate.service,
    amount,
    currency: "IDR",
    actualWeightKg,
    volumetricWeightKg,
    chargeableWeightKg,
    packageLengthCm,
    packageWidthCm,
    packageHeightCm,
    estimatedDelivery: rate.delivery,
    usedProductDefaults,
    disclaimer: "Estimated from packed ceramic dimensions and Pos Indonesia volumetric weight rules. Import duties and destination taxes are not included.",
  }
}
