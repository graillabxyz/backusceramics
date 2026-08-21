"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatPrice } from "@/lib/pos-catalog"

interface SummaryData {
  totals: { revenue: number; grossProfit: number; waste: number; marginPercent: number; unitsSold: number }
  chart: Array<{ date: string; revenue: number; grossProfit: number; waste: number }>
  menuItems: Array<{ productId: string; name: string; unitsSold: number; marginPercent: number; recipeComplete: boolean }>
}

const config = {
  revenue: { label: "Sales", color: "hsl(var(--chart-1))" },
  grossProfit: { label: "Gross profit", color: "hsl(var(--chart-2))" },
  waste: { label: "Waste", color: "hsl(var(--destructive))" },
} satisfies ChartConfig

export function MenuPerformanceSummary() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/admin/menu-performance")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))
  }, [])

  if (error) return null
  if (!data) {
    return <Card><CardContent className="flex h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
  }

  const missingCosts = data.menuItems.filter((item) => !item.recipeComplete && item.unitsSold > 0).length

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
        <div>
          <CardTitle>Menu performance</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Cafe sales, gross profit, and waste over the last 30 days.</p>
        </div>
        <Link href="/admin/menu-performance" className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          Open workspace <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 border-b md:grid-cols-4">
          {[
            ["Sales", formatPrice(data.totals.revenue)],
            ["Gross profit", formatPrice(data.totals.grossProfit)],
            ["Margin", `${data.totals.marginPercent.toFixed(1)}%`],
            ["Waste", formatPrice(data.totals.waste)],
          ].map(([label, value]) => (
            <div key={label} className="border-r p-4 last:border-r-0 md:p-5">
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="p-4 md:p-6">
            <ChartContainer config={config} className="h-[260px] w-full aspect-auto">
              <LineChart data={data.chart} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(value) => value.slice(5)} />
                <YAxis tickLine={false} axisLine={false} width={62} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <div className="flex min-w-40 justify-between gap-4"><span>{config[name as keyof typeof config]?.label}</span><strong>{formatPrice(Number(value))}</strong></div>} />} />
                <Line dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2.5} dot={false} />
                <Line dataKey="grossProfit" type="monotone" stroke="var(--color-grossProfit)" strokeWidth={2.5} dot={false} />
                <Line dataKey="waste" type="monotone" stroke="var(--color-waste)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
          <aside className="border-t p-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Most popular</p>
            <div className="mt-3 space-y-3">
              {data.menuItems.slice(0, 4).map((item, index) => (
                <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground">{index + 1}</span>{item.name}</span>
                  <strong className="shrink-0 tabular-nums">{item.unitsSold}</strong>
                </div>
              ))}
              {!data.menuItems.some((item) => item.unitsSold > 0) && <p className="text-sm text-muted-foreground">Sales will appear after checkout.</p>}
            </div>
            {missingCosts > 0 && (
              <div className="mt-5 flex gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                Add recipes to {missingCosts} sold item{missingCosts === 1 ? "" : "s"} for accurate margins.
              </div>
            )}
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}
