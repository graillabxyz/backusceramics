import assert from "node:assert/strict"
import test from "node:test"
import { calculateMarginPercent, calculateRecipeUnitCost, classifyMenuEfficiency, normalizeIngredientName } from "../lib/menu-costing"

test("recipe cost converts package prices into the quantity used", () => {
  assert.equal(calculateRecipeUnitCost([
    { packageCost: 120_000, packageQuantity: 1_000, quantity: 18 },
    { packageCost: 40_000, packageQuantity: 1_000, quantity: 250 },
  ]), 12_160)
})

test("margin excludes cost from net revenue", () => {
  assert.equal(calculateMarginPercent(50_000, 15_000), 70)
})

test("menu efficiency classification combines popularity and margin", () => {
  assert.equal(classifyMenuEfficiency({ unitsSold: 12, marginPercent: 70 }, 8), "STAR")
  assert.equal(classifyMenuEfficiency({ unitsSold: 12, marginPercent: 50 }, 8), "TRAFFIC_BUILDER")
  assert.equal(classifyMenuEfficiency({ unitsSold: 3, marginPercent: 70 }, 8), "HIDDEN_GEM")
  assert.equal(classifyMenuEfficiency({ unitsSold: 3, marginPercent: 50 }, 8), "REVIEW")
})

test("ingredient names normalize for duplicate prevention", () => {
  assert.equal(normalizeIngredientName("  Coconut   Milk "), "coconut milk")
})
