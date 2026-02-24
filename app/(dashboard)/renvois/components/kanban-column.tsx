"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { KanbanCard } from "./kanban-card"
import type { Renvoi, LaPosteTracking, RenvoiStatus } from "@/lib/types"

interface KanbanColumnProps {
  status: RenvoiStatus
  label: string
  icon: React.ElementType
  color: string // tailwind text color class e.g. "text-amber-600"
  bgColor: string // tailwind bg class e.g. "bg-amber-500/10"
  renvois: Renvoi[]
  trackingMap: Record<string, LaPosteTracking>
  onCardClick: (renvoi: Renvoi) => void
  onDrop: (renvoiId: string, newStatus: RenvoiStatus) => void
  draggedId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

export function KanbanColumn({
  status,
  label,
  icon: Icon,
  color,
  bgColor,
  renvois,
  trackingMap,
  onCardClick,
  onDrop,
  draggedId,
  onDragStart,
  onDragEnd,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = React.useState(false)

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-secondary/30 min-w-[85vw] sm:min-w-0 sm:flex-1 snap-center",
        dragOver && "bg-blue-500/5 border-blue-300"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const id = e.dataTransfer.getData("text/plain")
        if (id) onDrop(id, status)
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", bgColor)}>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">({renvois.length})</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-300px)]">
        {renvois.length === 0 && (
          <div className="text-center py-8 text-[12px] text-muted-foreground/60">
            Aucun renvoi
          </div>
        )}
        {renvois.map((r) => (
          <KanbanCard
            key={r.id}
            renvoi={r}
            tracking={r.trackingNumber ? trackingMap[r.trackingNumber] : undefined}
            onClick={() => onCardClick(r)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedId === r.id}
          />
        ))}
      </div>
    </div>
  )
}
