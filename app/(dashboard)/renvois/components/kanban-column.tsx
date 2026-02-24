"use client"

import { cn } from "@/lib/utils"
import { KanbanCard } from "./kanban-card"
import type { Renvoi, LaPosteTracking } from "@/lib/types"

interface KanbanColumnProps {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  renvois: Renvoi[]
  trackingMap: Record<string, LaPosteTracking>
  onCardClick: (renvoi: Renvoi) => void
}

export function KanbanColumn({
  label,
  icon: Icon,
  color,
  bgColor,
  renvois,
  trackingMap,
  onCardClick,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-secondary/30">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", bgColor)}>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
        <span className="text-[13px] font-semibold">{label}</span>
        {renvois.length > 0 && (
          <span className={cn("text-[11px] font-medium ml-auto px-1.5 py-0.5 rounded-full", bgColor, color)}>
            {renvois.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-340px)]">
        {renvois.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
            <Icon className="h-6 w-6 mb-2" />
            <span className="text-[12px]">Aucun renvoi</span>
          </div>
        )}
        {renvois.map((r) => (
          <KanbanCard
            key={r.id}
            renvoi={r}
            tracking={r.trackingNumber ? trackingMap[r.trackingNumber] : undefined}
            onClick={() => onCardClick(r)}
          />
        ))}
      </div>
    </div>
  )
}
