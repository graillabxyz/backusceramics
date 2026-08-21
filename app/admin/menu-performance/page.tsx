"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPrice } from "@/lib/pos-catalog"

type Ingredient = { id: string; name: string; packageCost: number; packageQuantity: number; unit: string; active: boolean; _count: { recipeLines: number } }
type RecipeLine = { ingredientId: string; name: string; unit: string; quantity: number; lineCost: number }
type Product = { id: string; name: string; price: number; status: string; recipeCost: number; recipeIngredients: RecipeLine[] }
type MenuItem = { productId: string; name: string; price: number; recipeCost: number; unitsSold: number; revenue: number; cost: number; wasteQuantity: number; wasteCost: number; grossProfit: number; marginPercent: number; efficiency: string; recipeComplete: boolean }
type WasteEntry = { id: string; businessDate: string; quantity: number; totalCost: number; reason: string | null; product: { name: string }; createdBy: { name: string | null; email: string } }
type Data = {
  totals: { revenue: number; cost: number; waste: number; grossProfit: number; unitsSold: number; marginPercent: number }
  chart: Array<{ date: string; revenue: number; cost: number; waste: number; grossProfit: number; unitsSold: number }>
  menuItems: MenuItem[]
  ingredients: Ingredient[]
  products: Product[]
  waste: WasteEntry[]
}

const chartConfig = {
  revenue: { label: "Sales", color: "hsl(var(--chart-1))" },
  grossProfit: { label: "Gross profit", color: "hsl(var(--chart-2))" },
  waste: { label: "Waste", color: "hsl(var(--destructive))" },
} satisfies ChartConfig

const efficiencyLabels: Record<string, string> = {
  STAR: "Star",
  TRAFFIC_BUILDER: "Traffic builder",
  HIDDEN_GEM: "Hidden gem",
  REVIEW: "Review",
}

function todayInBali() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}

async function postAction(body: unknown) {
  const response = await fetch("/api/admin/menu-performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || "Could not save this update.")
  return payload
}

export default function MenuPerformancePage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ingredientForm, setIngredientForm] = useState({ id: "", name: "", packageCost: "", packageQuantity: "", unit: "G" })
  const [recipeProductId, setRecipeProductId] = useState("")
  const [recipeLines, setRecipeLines] = useState<Array<{ ingredientId: string; quantity: string }>>([])
  const [wasteForm, setWasteForm] = useState({ productId: "", quantity: "1", businessDate: todayInBali(), reason: "" })

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/menu-performance", { cache: "no-store" })
      if (!response.ok) throw new Error()
      const payload = await response.json()
      setData(payload)
      setRecipeProductId((current) => current || payload.products[0]?.id || "")
      setWasteForm((current) => ({ ...current, productId: current.productId || payload.products[0]?.id || "" }))
    } catch {
      toast.error("Could not load menu performance.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectedProduct = data?.products.find((product) => product.id === recipeProductId)
  useEffect(() => {
    setRecipeLines(selectedProduct?.recipeIngredients.map((line) => ({ ingredientId: line.ingredientId, quantity: String(line.quantity) })) || [])
  }, [selectedProduct])

  const recipeEstimate = useMemo(() => recipeLines.reduce((sum, line) => {
    const ingredient = data?.ingredients.find((item) => item.id === line.ingredientId)
    if (!ingredient || ingredient.packageQuantity <= 0) return sum
    return sum + ingredient.packageCost / ingredient.packageQuantity * Number(line.quantity || 0)
  }, 0), [data?.ingredients, recipeLines])

  async function saveIngredient(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await postAction({ action: "ingredient", ...ingredientForm, packageCost: Number(ingredientForm.packageCost), packageQuantity: Number(ingredientForm.packageQuantity) })
      toast.success(ingredientForm.id ? "Ingredient updated." : "Ingredient added.")
      setIngredientForm({ id: "", name: "", packageCost: "", packageQuantity: "", unit: "G" })
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save ingredient.") }
    finally { setSaving(false) }
  }

  async function saveRecipe() {
    setSaving(true)
    try {
      await postAction({ action: "recipe", productId: recipeProductId, lines: recipeLines.map((line) => ({ ingredientId: line.ingredientId, quantity: Number(line.quantity) })) })
      toast.success("Recipe saved. Future sales will use this cost.")
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save recipe.") }
    finally { setSaving(false) }
  }

  async function recordWaste(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await postAction({ action: "waste", ...wasteForm, quantity: Number(wasteForm.quantity) })
      toast.success("Waste recorded.")
      setWasteForm((current) => ({ ...current, quantity: "1", reason: "" }))
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not record waste.") }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
  if (!data) return <div className="rounded-md border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">Menu performance could not be loaded.</div>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Menu performance</h1>
          <p className="mt-1 text-muted-foreground">Understand what sells, what earns, and what gets wasted.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </header>

      <Tabs defaultValue="overview" className="gap-5">
        <div className="overflow-x-auto pb-1"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="ingredients">Ingredients</TabsTrigger><TabsTrigger value="recipes">Recipes</TabsTrigger><TabsTrigger value="waste">Waste</TabsTrigger></TabsList></div>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Net sales", formatPrice(data.totals.revenue)],
              ["Gross profit", formatPrice(data.totals.grossProfit)],
              ["Margin", `${data.totals.marginPercent.toFixed(1)}%`],
              ["Waste", formatPrice(data.totals.waste)],
              ["Items sold", data.totals.unitsSold.toLocaleString()],
            ].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}
          </div>
          <Card>
            <CardHeader><CardTitle>Sales and profitability</CardTitle><CardDescription>Last 30 days. Revenue excludes tax; waste reduces gross profit.</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[340px] w-full aspect-auto">
                <AreaChart data={data.chart} margin={{ left: 8, right: 16 }}>
                  <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.25}/><stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(value) => value.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} width={68} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <div className="flex min-w-44 justify-between gap-4"><span>{chartConfig[name as keyof typeof chartConfig]?.label}</span><strong>{formatPrice(Number(value))}</strong></div>} />} />
                  <Area dataKey="revenue" type="monotone" fill="url(#salesFill)" stroke="var(--color-revenue)" strokeWidth={2.5} />
                  <Area dataKey="grossProfit" type="monotone" fill="transparent" stroke="var(--color-grossProfit)" strokeWidth={2.5} />
                  <Area dataKey="waste" type="monotone" fill="transparent" stroke="var(--color-waste)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Menu efficiency</CardTitle><CardDescription>Popularity is measured against sold menu items; high margin currently means 65% or better.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Menu item</th><th>Position</th><th>Sold</th><th>Sales</th><th>Waste</th><th>Unit cost</th><th>Margin</th></tr></thead>
                <tbody>{data.menuItems.map((item) => <tr key={item.productId} className="border-b last:border-0"><td className="px-5 py-4"><p className="font-medium">{item.name}</p>{!item.recipeComplete && <p className="text-xs text-amber-700">Recipe needed</p>}</td><td><Badge variant={item.efficiency === "STAR" ? "default" : "secondary"}>{efficiencyLabels[item.efficiency]}</Badge></td><td className="tabular-nums">{item.unitsSold}</td><td className="tabular-nums">{formatPrice(item.revenue)}</td><td className="tabular-nums">{item.wasteQuantity} / {formatPrice(item.wasteCost)}</td><td className="tabular-nums">{formatPrice(item.recipeCost)}</td><td className="font-medium tabular-nums">{item.recipeComplete ? `${item.marginPercent.toFixed(1)}%` : "-"}</td></tr>)}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card><CardHeader><CardTitle>{ingredientForm.id ? "Edit ingredient" : "Add ingredient"}</CardTitle><CardDescription>Enter the supplier package price and the amount inside it.</CardDescription></CardHeader><CardContent>
            <form className="space-y-4" onSubmit={saveIngredient}>
              <div className="space-y-2"><Label htmlFor="ingredient-name">Ingredient name</Label><Input id="ingredient-name" value={ingredientForm.name} onChange={(event) => setIngredientForm({ ...ingredientForm, name: event.target.value })} placeholder="Coffee beans" required /></div>
              <div className="space-y-2"><Label htmlFor="ingredient-cost">Package price (IDR)</Label><Input id="ingredient-cost" type="number" min="1" value={ingredientForm.packageCost} onChange={(event) => setIngredientForm({ ...ingredientForm, packageCost: event.target.value })} placeholder="180000" required /></div>
              <div className="grid grid-cols-[1fr_110px] gap-3"><div className="space-y-2"><Label htmlFor="ingredient-quantity">Package amount</Label><Input id="ingredient-quantity" type="number" min="0.001" step="any" value={ingredientForm.packageQuantity} onChange={(event) => setIngredientForm({ ...ingredientForm, packageQuantity: event.target.value })} placeholder="1000" required /></div><div className="space-y-2"><Label htmlFor="ingredient-unit">Unit</Label><select id="ingredient-unit" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={ingredientForm.unit} onChange={(event) => setIngredientForm({ ...ingredientForm, unit: event.target.value })}><option value="G">grams</option><option value="ML">milliliters</option><option value="EACH">each</option></select></div></div>
              <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>{ingredientForm.id && <Button type="button" variant="outline" onClick={() => setIngredientForm({ id: "", name: "", packageCost: "", packageQuantity: "", unit: "G" })}>Cancel</Button>}</div>
            </form>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Ingredient prices</CardTitle><CardDescription>{data.ingredients.length} ingredients available to recipes.</CardDescription></CardHeader><CardContent className="divide-y p-0">{data.ingredients.map((ingredient) => <button key={ingredient.id} type="button" onClick={() => setIngredientForm({ id: ingredient.id, name: ingredient.name, packageCost: String(ingredient.packageCost), packageQuantity: String(ingredient.packageQuantity), unit: ingredient.unit })} className="grid w-full grid-cols-[1fr_auto] gap-4 px-5 py-4 text-left hover:bg-muted/40"><span><strong className="block">{ingredient.name}</strong><span className="text-xs text-muted-foreground">Used in {ingredient._count.recipeLines} recipe{ingredient._count.recipeLines === 1 ? "" : "s"}</span></span><span className="text-right text-sm"><strong>{formatPrice(ingredient.packageCost)}</strong><span className="block text-xs text-muted-foreground">{ingredient.packageQuantity.toLocaleString()} {ingredient.unit.toLowerCase()} · {formatPrice(Math.round(ingredient.packageCost / ingredient.packageQuantity))}/{ingredient.unit.toLowerCase()}</span></span></button>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="recipes" className="space-y-5">
          <Card><CardHeader><CardTitle>Recipe costing</CardTitle><CardDescription>Quantities use the same unit as each ingredient. Saving affects future sale snapshots.</CardDescription></CardHeader><CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(130px,auto))]"><div className="space-y-2"><Label>Menu item</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={recipeProductId} onChange={(event) => setRecipeProductId(event.target.value)}>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><Metric label="Selling price" value={formatPrice(selectedProduct?.price || 0)} /><Metric label="Recipe cost" value={formatPrice(Math.round(recipeEstimate))} /><Metric label="Gross margin" value={selectedProduct?.price ? `${Math.max(0, (selectedProduct.price - recipeEstimate) / selectedProduct.price * 100).toFixed(1)}%` : "-"} /></div>
            <div className="space-y-3">{recipeLines.map((line, index) => <div key={`${line.ingredientId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_130px_40px] gap-2"><select className="h-10 min-w-0 rounded-md border bg-background px-3" value={line.ingredientId} onChange={(event) => setRecipeLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ingredientId: event.target.value } : item))}><option value="">Choose ingredient</option>{data.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit.toLowerCase()})</option>)}</select><Input type="number" min="0.001" step="any" value={line.quantity} onChange={(event) => setRecipeLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} aria-label="Recipe quantity" /><Button type="button" size="icon" variant="ghost" onClick={() => setRecipeLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove ingredient"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setRecipeLines((current) => [...current, { ingredientId: data.ingredients.find((ingredient) => !current.some((line) => line.ingredientId === ingredient.id))?.id || "", quantity: "" }])} disabled={!data.ingredients.length}><Plus className="h-4 w-4" /> Add ingredient</Button><Button type="button" onClick={saveRecipe} disabled={saving || !recipeProductId}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save recipe</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="waste" className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <Card><CardHeader><CardTitle>Record food waste</CardTitle><CardDescription>Record completed portions discarded. Cost is captured from today&apos;s recipe.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={recordWaste}><div className="space-y-2"><Label>Menu item</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={wasteForm.productId} onChange={(event) => setWasteForm({ ...wasteForm, productId: event.target.value })}>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Portions</Label><Input type="number" min="1" max="999" value={wasteForm.quantity} onChange={(event) => setWasteForm({ ...wasteForm, quantity: event.target.value })} /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={wasteForm.businessDate} onChange={(event) => setWasteForm({ ...wasteForm, businessDate: event.target.value })} /></div></div><div className="space-y-2"><Label>Reason (optional)</Label><Input value={wasteForm.reason} onChange={(event) => setWasteForm({ ...wasteForm, reason: event.target.value })} placeholder="Spoiled, returned, prep error..." /></div><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Record waste</Button></form></CardContent></Card>
          <Card><CardHeader><CardTitle>Recent waste</CardTitle><CardDescription>Waste is included in realized gross profit.</CardDescription></CardHeader><CardContent className="divide-y p-0">{data.waste.map((entry) => <div key={entry.id} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4"><div><strong>{entry.product.name}</strong><p className="text-sm text-muted-foreground">{entry.quantity} portion{entry.quantity === 1 ? "" : "s"}{entry.reason ? ` · ${entry.reason}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{entry.businessDate} · {entry.createdBy.name || entry.createdBy.email}</p></div><strong className="text-destructive">{formatPrice(entry.totalCost)}</strong></div>)}{data.waste.length === 0 && <p className="p-6 text-sm text-muted-foreground">No waste recorded in the last 30 days.</p>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border bg-muted/20 px-4 py-3"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>
}
