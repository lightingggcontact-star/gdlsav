"use client"

import { useState } from "react"
import { Clock, Truck, CircleCheck, XCircle } from "lucide-react"
import { KanbanColumn } from "./kanban-column"
import type { Renvoi, LaPosteTracking, RenvoiStatus } from "@/lib/types"

const COLUMNS: {
  status: RenvoiStatus
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
}[] = [
  { status: "en_cours", label: "A traiter", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10" },
  { status: "expedie", label: "Expedie", icon: Truck, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  { status: "livre", label: "Livre", icon: CircleCheck, color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
  { status: "annule", label: "Annule", icon: XCircle, color: "text-red-600", bgColor: "bg-red-500/10" },
]

interface KanbanBoardProps {
  renvois: Renvoi[]
  trackingMap: Record<string, LaPosteTracking>
  onCardClick: (renvoi: Renvoi) => void
  onStatusChange: (id: string, newStatus: RenvoiStatus) => void
}

export function KanbanBoard({ renvois, trackingMap, onCardClick, onStatusChange }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Group renvois by status
  const grouped: Record<RenvoiStatus, Renvoi[]> = {
    en_cours: [],
    expedie: [],
    livre: [],
    annule: [],
  }
  for (const r of renvois) {
    grouped[r.status]?.push(r)
  }

  function handleDrop(renvoiId: string, newStatus: RenvoiStatus) {
    setDraggedId(null)
    // Find the renvoi to check if status actually changed
    const renvoi = renvois.find((r) => r.id === renvoiId)
    if (renvoi && renvoi.status !== newStatus) {
      onStatusChange(renvoiId, newStatus)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 sm:snap-none sm:overflow-x-visible">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          label={col.label}
          icon={col.icon}
          color={col.color}
          bgColor={col.bgColor}
          renvois={grouped[col.status]}
          trackingMap={trackingMap}
          onCardClick={onCardClick}
          onDrop={handleDrop}
          draggedId={draggedId}
          onDragStart={setDraggedId}
          onDragEnd={() => setDraggedId(null)}
        />
      ))}
    </div>
  )
}
