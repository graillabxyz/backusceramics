export interface RecipeCostLine {
  packageCost: number
  packageQuantity: number
  quantity: number
}

export interface MenuEfficiencyInput {
  unitsSold: number
  marginPercent: number
}

export function normalizeIngredientName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
}

export function calculateRecipeUnitCost(lines: RecipeCostLine[]) {
  const total = lines.reduce((sum, line) => {
    if (!Number.isFinite(line.packageCost) || !Number.isFinite(line.packageQuantity) || !Number.isFinite(line.quantity)) return sum
    if (line.packageCost < 0 || line.packageQuantity <= 0 || line.quantity < 0) return sum
    return sum + (line.packageCost / line.packageQuantity) * line.quantity
  }, 0)
  return Math.max(0, Math.round(total))
}

export function calculateMarginPercent(revenue: number, cost: number) {
  if (!Number.isFinite(revenue) || revenue <= 0) return 0
  return Math.round(((revenue - Math.max(0, cost)) / revenue) * 1000) / 10
}

export function classifyMenuEfficiency(input: MenuEfficiencyInput, medianUnits: number, targetMarginPercent = 65) {
  const popular = input.unitsSold >= Math.max(1, medianUnits)
  const profitable = input.marginPercent >= targetMarginPercent
  if (popular && profitable) return "STAR"
  if (popular) return "TRAFFIC_BUILDER"
  if (profitable) return "HIDDEN_GEM"
  return "REVIEW"
}
