import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MobileStickyCtaProps {
  title: ReactNode
  detail?: ReactNode
  children: ReactNode
  className?: string
}

export function MobileStickyCta({ title, detail, children, className }: MobileStickyCtaProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-12px_32px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden",
        className
      )}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  )
}
