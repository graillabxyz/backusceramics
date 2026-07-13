"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, List, Loader2, Plus, RefreshCw, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { addDays, formatDateKey, parseDateKey } from "@/lib/class-schedule"

export interface ClassOperationsHold {
  id: string
  studentName: string
  seats: number
}

export interface ClassOperationsRow {
  sessionId: string
  scheduleId?: string
  workshopId: string
  title: string
  category: string
  dateKey: string
  timeLabel: string
  maxParticipants: number
  bookedSeats: number
  heldSeats: number
  availableSeats: number
  holds: ClassOperationsHold[]
}

interface ClassOperationsCalendarProps {
  monthStart: string
  monthLabel: string
  rows: ClassOperationsRow[]
  loading: boolean
  error?: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onRefresh: () => void
  onHoldSeat: (row: ClassOperationsRow) => void
  onEditHold: (holdId: string) => void
  onAddSchedule: (dateKey: string) => void
}

const shortDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function dateLabel(dateKey: string, includeYear = false) {
  const date = parseDateKey(dateKey)
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date)
}

function rowsByDate(rows: ClassOperationsRow[]) {
  return rows.reduce<Record<string, ClassOperationsRow[]>>((groups, row) => {
    groups[row.dateKey] = [...(groups[row.dateKey] || []), row]
    return groups
  }, {})
}

function categoryTone(category: string) {
  const normalized = category.toLowerCase()
  if (normalized.includes("event")) return "border-rose-200 bg-rose-50 text-rose-950"
  if (normalized.includes("multi")) return "border-amber-200 bg-amber-50 text-amber-950"
  if (normalized.includes("kid")) return "border-sky-200 bg-sky-50 text-sky-950"
  return "border-emerald-200 bg-emerald-50 text-emerald-950"
}

function capacityTone(row: ClassOperationsRow) {
  if (row.availableSeats <= 0) return "bg-destructive"
  if (row.availableSeats === 1) return "bg-amber-500"
  return "bg-emerald-600"
}

function SessionSummary({ row, compact = false }: { row: ClassOperationsRow; compact?: boolean }) {
  const occupied = Math.min(row.maxParticipants, row.bookedSeats + row.heldSeats)
  const percent = row.maxParticipants > 0 ? Math.round((occupied / row.maxParticipants) * 100) : 0

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-medium">{row.title}</span>
        {row.availableSeats <= 0 && <span className="shrink-0 text-[10px] font-semibold uppercase">Full</span>}
      </div>
      <div className={cn("mt-0.5 flex items-center gap-1.5 text-[11px] opacity-75", compact && "hidden xl:flex")}>
        <span>{row.timeLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{row.availableSeats} open</span>
      </div>
      {!compact && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
          <div className={cn("h-full rounded-full", capacityTone(row))} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  )
}

export function ClassOperationsCalendar({
  monthStart,
  monthLabel,
  rows,
  loading,
  error,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onRefresh,
  onHoldSeat,
  onEditHold,
  onAddSchedule,
}: ClassOperationsCalendarProps) {
  const [view, setView] = useState<"month" | "agenda">("month")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const groupedRows = useMemo(() => rowsByDate(rows), [rows])
  const monthDate = parseDateKey(monthStart)
  const todayKey = formatDateKey(new Date())

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setView("agenda")
    }
  }, [])

  useEffect(() => {
    setSelectedDate(null)
  }, [monthStart])

  const calendarDays = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const mondayOffset = (first.getDay() + 6) % 7
    const gridStart = addDays(first, -mondayOffset)
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [monthStart])
  const activeDates = Object.keys(groupedRows).sort()
  const selectedRows = selectedDate ? groupedRows[selectedDate] || [] : []

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onToday}>Today</Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-1 truncate text-lg font-semibold text-foreground sm:text-xl">{monthLabel}</h2>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5" aria-label="Calendar view">
            <Button type="button" size="sm" variant={view === "month" ? "secondary" : "ghost"} className="h-8" onClick={() => setView("month")}>
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Month
            </Button>
            <Button type="button" size="sm" variant={view === "agenda" ? "secondary" : "ghost"} className="h-8" onClick={() => setView("agenda")}>
              <List className="mr-1.5 h-4 w-4" />
              Agenda
            </Button>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRefresh} disabled={loading} aria-label="Refresh calendar">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />Open</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />One seat left</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" />Full</span>
        <span className="ml-auto hidden sm:inline">Select a session for bookings, holds, and capacity.</span>
      </div>

      {error ? (
        <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : view === "month" ? (
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {shortDayLabels.map((day) => <div key={day} className="px-1 py-2 text-center text-[11px] font-semibold text-muted-foreground sm:text-xs">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const dateKey = formatDateKey(date)
              const dayRows = groupedRows[dateKey] || []
              const outsideMonth = date.getMonth() !== monthDate.getMonth()
              const isToday = dateKey === todayKey
              return (
                <div key={dateKey} className={cn("min-h-24 border-b border-r border-border p-1 sm:min-h-32 sm:p-1.5 xl:min-h-36", outsideMonth && "bg-muted/20 text-muted-foreground")}>
                  <button type="button" onClick={() => setSelectedDate(dateKey)} className={cn("mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium hover:bg-muted", isToday && "bg-primary text-primary-foreground hover:bg-primary")} aria-label={`Open ${dateLabel(dateKey, true)}`}>
                    {date.getDate()}
                  </button>
                  <div className="space-y-1">
                    {dayRows.slice(0, 3).map((row) => (
                      <button key={`${row.sessionId}-${row.timeLabel}`} type="button" onClick={() => setSelectedDate(dateKey)} className={cn("block w-full overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] transition hover:brightness-95", categoryTone(row.category))}>
                        <SessionSummary row={row} compact />
                      </button>
                    ))}
                    {dayRows.length > 3 && <button type="button" onClick={() => setSelectedDate(dateKey)} className="w-full px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">+{dayRows.length - 3} more</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activeDates.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No bookable sessions this month</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a session or move to another month.</p>
              <Button type="button" className="mt-4" onClick={() => onAddSchedule(monthStart)}><Plus className="mr-2 h-4 w-4" />Add schedule</Button>
            </div>
          ) : activeDates.map((dateKey) => (
            <section key={dateKey} className="grid gap-3 px-3 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:px-4">
              <button type="button" onClick={() => setSelectedDate(dateKey)} className="text-left">
                <p className="text-sm font-semibold text-foreground">{dateLabel(dateKey)}</p>
                <p className="text-xs text-muted-foreground">{groupedRows[dateKey].length} session{groupedRows[dateKey].length === 1 ? "" : "s"}</p>
              </button>
              <div className="grid gap-2 lg:grid-cols-2">
                {groupedRows[dateKey].map((row) => (
                  <button key={`${row.sessionId}-${row.timeLabel}`} type="button" onClick={() => setSelectedDate(dateKey)} className={cn("rounded-md border p-3 text-left transition hover:shadow-sm", categoryTone(row.category))}>
                    <SessionSummary row={row} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent side="right" className="!w-full gap-0 overflow-y-auto p-0 sm:!max-w-md">
          <SheetHeader className="border-b border-border px-5 py-5 pr-12 text-left">
            <SheetTitle className="text-xl">{selectedDate ? dateLabel(selectedDate, true) : "Day details"}</SheetTitle>
            <SheetDescription>Review every session sharing this day&apos;s studio capacity.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4 sm:p-5">
            {selectedRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
                <p className="font-medium">No public sessions</p>
                <p className="mt-1 text-sm text-muted-foreground">Add a public class or event on this date.</p>
              </div>
            ) : selectedRows.map((row) => (
              <article key={`${row.sessionId}-${row.timeLabel}`} className="rounded-md border border-border bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{row.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />{row.timeLabel}</p>
                  </div>
                  <Badge variant={row.availableSeats <= 0 ? "secondary" : "outline"}>{row.availableSeats <= 0 ? "Full" : `${row.availableSeats} open`}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/50 px-2 py-2"><p className="text-lg font-semibold">{row.maxParticipants}</p><p className="text-[11px] text-muted-foreground">Total</p></div>
                  <div className="rounded-md bg-muted/50 px-2 py-2"><p className="text-lg font-semibold">{row.bookedSeats}</p><p className="text-[11px] text-muted-foreground">Booked</p></div>
                  <div className="rounded-md bg-muted/50 px-2 py-2"><p className="text-lg font-semibold">{row.heldSeats}</p><p className="text-[11px] text-muted-foreground">Held</p></div>
                </div>
                {row.holds.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Users className="h-3.5 w-3.5" />Seat holds</p>
                    {row.holds.map((hold) => (
                      <button key={hold.id} type="button" onClick={() => onEditHold(hold.id)} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted">
                        <span className="truncate">{hold.studentName}</span>
                        <span className="shrink-0 text-muted-foreground">{hold.seats} seat{hold.seats === 1 ? "" : "s"}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={row.availableSeats <= 0}
                  onClick={() => {
                    onHoldSeat(row)
                    setSelectedDate(null)
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />Hold a seat
                </Button>
              </article>
            ))}
            {selectedDate && (
              <Button type="button" className="w-full" onClick={() => onAddSchedule(selectedDate)}>
                <Plus className="mr-2 h-4 w-4" />Add public session on this date
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
