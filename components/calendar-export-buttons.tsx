"use client"

import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildGoogleCalendarUrl,
  buildIcsDataUrl,
  CalendarExportEvent,
} from "@/lib/calendar-export"

interface CalendarExportButtonsProps {
  event: CalendarExportEvent
  compact?: boolean
}

export function CalendarExportButtons({ event, compact = false }: CalendarExportButtonsProps) {
  const filename = `${event.title}-${event.dateKey}.ics`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase()

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-col gap-2 sm:flex-row"}>
      <Button asChild variant="outline" size={compact ? "sm" : "default"} className="gap-2">
        <a href={buildIcsDataUrl(event)} download={filename}>
          <CalendarPlus className="h-4 w-4" />
          Apple / Outlook
        </a>
      </Button>
      <Button asChild variant="outline" size={compact ? "sm" : "default"} className="gap-2">
        <a href={buildGoogleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
          <CalendarPlus className="h-4 w-4" />
          Google Calendar
        </a>
      </Button>
    </div>
  )
}
