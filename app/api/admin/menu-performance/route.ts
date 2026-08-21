import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { calculateMarginPercent, calculateRecipeUnitCost, classifyMenuEfficiency, normalizeIngredientName } from "@/lib/menu-costing"
import { normalizeProductCategory } from "@/lib/pos-catalog"
import { prisma } from "@/lib/prisma"
import { canViewAnalytics } from "@/lib/permissions"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_BODY_BYTES = 32 * 1024
const MENU_UNITS = new Set(["G", "ML", "EACH"])
const BALI_TIME_ZONE = "Asia/Makassar"

function dayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BALI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dateKeys(days: number) {
  const now = new Date()
  return Array.from({ length: days }, (_, index) => dayKey(new Date(now.getTime() - (days - index - 1) * 86_400_000)))
}

function validBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) && value <= dayKey(new Date())
}

async function authorize() {
  const session = await auth()
  if (!session || !canViewAnalytics(session.user.role)) return null
  return session
}

export async function GET() {
  const session = await authorize()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const days = dateKeys(30)
  const since = new Date(Date.now() - 31 * 86_400_000)
  const [ingredients, products, sales, waste] = await Promise.all([
    prisma.menuIngredient.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { recipeLines: true } } },
    }),
    prisma.posProduct.findMany({
      where: { OR: [{ cafeOnly: true }, { category: "F_AND_B" }] },
      orderBy: { name: "asc" },
      include: {
        recipeIngredients: {
          orderBy: { ingredient: { name: "asc" } },
          include: { ingredient: true },
        },
      },
    }),
    prisma.posSale.findMany({
      where: { status: "PAID", createdAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        items: {
          where: { productId: { not: null } },
          select: {
            productId: true,
            nameSnapshot: true,
            categorySnapshot: true,
            quantity: true,
            subtotal: true,
            discountAmount: true,
            unitCostSnapshot: true,
            costTotal: true,
          },
        },
      },
    }),
    prisma.menuWasteEntry.findMany({
      where: { businessDate: { gte: days[0], lte: days[days.length - 1] } },
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      include: {
        product: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
  ])

  const recipeCosts = new Map(products.map((product) => [
    product.id,
    calculateRecipeUnitCost(product.recipeIngredients.map((line) => ({
      packageCost: line.ingredient.packageCost,
      packageQuantity: line.ingredient.packageQuantity,
      quantity: line.quantity,
    }))),
  ]))
  const productMap = new Map(products.map((product) => [product.id, product]))
  const daily = new Map(days.map((date) => [date, { date, revenue: 0, cost: 0, waste: 0, grossProfit: 0, unitsSold: 0 }]))
  const itemMetrics = new Map(products.map((product) => [product.id, {
    productId: product.id,
    name: product.name,
    price: product.price,
    recipeCost: recipeCosts.get(product.id) || 0,
    unitsSold: 0,
    revenue: 0,
    cost: 0,
    wasteQuantity: 0,
    wasteCost: 0,
  }]))

  for (const sale of sales) {
    const date = dayKey(sale.createdAt)
    const day = daily.get(date)
    if (!day) continue
    for (const item of sale.items) {
      if (!item.productId || normalizeProductCategory(item.categorySnapshot) !== "F_AND_B") continue
      const current = itemMetrics.get(item.productId)
      if (!current) continue
      const revenue = Math.max(0, item.subtotal - item.discountAmount)
      const cost = item.costTotal > 0 ? item.costTotal : (recipeCosts.get(item.productId) || 0) * item.quantity
      current.unitsSold += item.quantity
      current.revenue += revenue
      current.cost += cost
      day.revenue += revenue
      day.cost += cost
      day.unitsSold += item.quantity
    }
  }

  for (const entry of waste) {
    const current = itemMetrics.get(entry.productId)
    if (current) {
      current.wasteQuantity += entry.quantity
      current.wasteCost += entry.totalCost
    }
    const day = daily.get(entry.businessDate)
    if (day) day.waste += entry.totalCost
  }

  const soldCounts = Array.from(itemMetrics.values()).map((item) => item.unitsSold).filter((count) => count > 0).sort((a, b) => a - b)
  const medianUnits = soldCounts.length ? soldCounts[Math.floor(soldCounts.length / 2)] : 0
  const menuItems = Array.from(itemMetrics.values()).map((item) => {
    const marginPercent = calculateMarginPercent(item.revenue, item.cost + item.wasteCost)
    return {
      ...item,
      grossProfit: item.revenue - item.cost - item.wasteCost,
      marginPercent,
      efficiency: classifyMenuEfficiency({ unitsSold: item.unitsSold, marginPercent }, medianUnits),
      recipeComplete: (productMap.get(item.productId)?.recipeIngredients.length || 0) > 0,
    }
  }).sort((a, b) => b.unitsSold - a.unitsSold || b.grossProfit - a.grossProfit)

  const chart = Array.from(daily.values()).map((point) => ({
    ...point,
    grossProfit: point.revenue - point.cost - point.waste,
  }))
  const totals = chart.reduce((sum, point) => ({
    revenue: sum.revenue + point.revenue,
    cost: sum.cost + point.cost,
    waste: sum.waste + point.waste,
    grossProfit: sum.grossProfit + point.grossProfit,
    unitsSold: sum.unitsSold + point.unitsSold,
  }), { revenue: 0, cost: 0, waste: 0, grossProfit: 0, unitsSold: 0 })

  return NextResponse.json({
    totals: { ...totals, marginPercent: calculateMarginPercent(totals.revenue, totals.cost + totals.waste) },
    chart,
    menuItems,
    ingredients,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      status: product.status,
      recipeCost: recipeCosts.get(product.id) || 0,
      recipeIngredients: product.recipeIngredients.map((line) => ({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        unit: line.ingredient.unit,
        quantity: line.quantity,
        lineCost: Math.round((line.ingredient.packageCost / line.ingredient.packageQuantity) * line.quantity),
      })),
    })),
    waste,
    period: { days: 30, start: days[0], end: days[days.length - 1] },
  })
}

export async function POST(req: NextRequest) {
  const session = await authorize()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (isRequestBodyTooLarge(req, MAX_BODY_BYTES)) return NextResponse.json({ error: "Menu costing request is too large." }, { status: 413 })
  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : ""

  try {
    if (action === "ingredient") {
      const id = typeof body.id === "string" ? body.id : ""
      const name = typeof body.name === "string" ? cleanString(body.name, 120) : ""
      const packageCost = Number(body.packageCost)
      const packageQuantity = Number(body.packageQuantity)
      const unit = typeof body.unit === "string" ? body.unit.toUpperCase() : ""
      if (name.length < 2) return NextResponse.json({ error: "Enter an ingredient name." }, { status: 400 })
      if (!Number.isSafeInteger(packageCost) || packageCost < 1 || packageCost > 100_000_000) return NextResponse.json({ error: "Enter a valid package price in IDR." }, { status: 400 })
      if (!Number.isFinite(packageQuantity) || packageQuantity <= 0 || packageQuantity > 1_000_000) return NextResponse.json({ error: "Enter the amount contained in the package." }, { status: 400 })
      if (!MENU_UNITS.has(unit)) return NextResponse.json({ error: "Choose grams, milliliters, or each." }, { status: 400 })
      const data = { name, normalizedName: normalizeIngredientName(name), packageCost, packageQuantity, unit }
      const ingredient = id
        ? await prisma.menuIngredient.update({ where: { id }, data })
        : await prisma.menuIngredient.create({ data })
      return NextResponse.json(ingredient, { status: id ? 200 : 201 })
    }

    if (action === "recipe") {
      const productId = typeof body.productId === "string" ? body.productId : ""
      const rawLines = Array.isArray(body.lines) ? body.lines : []
      const product = await prisma.posProduct.findUnique({ where: { id: productId }, select: { id: true, cafeOnly: true, category: true } })
      if (!product || (!product.cafeOnly && product.category !== "F_AND_B")) return NextResponse.json({ error: "Choose a cafe menu item." }, { status: 400 })
      const lines = rawLines.map((line: unknown) => {
        const value = line as { ingredientId?: unknown; quantity?: unknown }
        return { ingredientId: typeof value.ingredientId === "string" ? value.ingredientId : "", quantity: Number(value.quantity) }
      })
      if (lines.length > 50 || lines.some((line: { ingredientId: string; quantity: number }) => !line.ingredientId || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1_000_000)) {
        return NextResponse.json({ error: "Recipe quantities must be greater than zero." }, { status: 400 })
      }
      if (new Set(lines.map((line: { ingredientId: string }) => line.ingredientId)).size !== lines.length) return NextResponse.json({ error: "Each ingredient can appear once in a recipe." }, { status: 400 })
      const ingredientCount = await prisma.menuIngredient.count({ where: { id: { in: lines.map((line: { ingredientId: string }) => line.ingredientId) }, active: true } })
      if (ingredientCount !== lines.length) return NextResponse.json({ error: "One of those ingredients is no longer available." }, { status: 400 })
      await prisma.$transaction(async (tx) => {
        await tx.menuRecipeIngredient.deleteMany({ where: { productId } })
        if (lines.length) await tx.menuRecipeIngredient.createMany({ data: lines.map((line: { ingredientId: string; quantity: number }) => ({ productId, ...line })) })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return NextResponse.json({ ok: true })
    }

    if (action === "waste") {
      const productId = typeof body.productId === "string" ? body.productId : ""
      const quantity = Number(body.quantity)
      const businessDate = typeof body.businessDate === "string" ? body.businessDate : ""
      const reason = typeof body.reason === "string" ? cleanString(body.reason, 500) : ""
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return NextResponse.json({ error: "Enter the number of portions wasted." }, { status: 400 })
      if (!validBusinessDate(businessDate)) return NextResponse.json({ error: "Choose a valid waste date." }, { status: 400 })
      const product = await prisma.posProduct.findUnique({
        where: { id: productId },
        include: { recipeIngredients: { include: { ingredient: true } } },
      })
      if (!product || (!product.cafeOnly && product.category !== "F_AND_B")) return NextResponse.json({ error: "Choose a cafe menu item." }, { status: 400 })
      const unitCostSnapshot = calculateRecipeUnitCost(product.recipeIngredients.map((line) => ({
        packageCost: line.ingredient.packageCost,
        packageQuantity: line.ingredient.packageQuantity,
        quantity: line.quantity,
      })))
      if (unitCostSnapshot <= 0) return NextResponse.json({ error: "Add this item's recipe before recording waste." }, { status: 409 })
      const entry = await prisma.menuWasteEntry.create({
        data: { productId, quantity, unitCostSnapshot, totalCost: unitCostSnapshot * quantity, businessDate, reason: reason || null, createdById: session.user.id },
      })
      return NextResponse.json(entry, { status: 201 })
    }

    return NextResponse.json({ error: "Unknown menu costing action." }, { status: 400 })
  } catch (error) {
    console.error("Menu performance update failed", { action, error })
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That ingredient already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Could not save this menu costing update." }, { status: 500 })
  }
}
