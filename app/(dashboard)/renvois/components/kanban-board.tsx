"use client"

import { Clock, Truck, CircleCheck } from "lucide-react"
import { KanbanColumn } from "./kanban-column"
import type { Renvoi, LaPosteTracking, RenvoiStatus } from "@/lib/types"

const COLUMNS: {
  status: RenvoiStatus
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
}[] = [
  { status: "a_renvoyer", label: "A renvoyer", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/10" },
  { status: "expedie", label: "Expedie", icon: Truck, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  { status: "livre", label: "Livre", icon: CircleCheck, color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
]

interface KanbanBoardProps {
  renvois: Renvoi[]
  trackingMap: Record<string, LaPosteTracking>
  onCardClick: (renvoi: Renvoi) => void
}

function sortRenvois(renvois: Renvoi[], status: RenvoiStatus): Renvoi[] {
  return [...renvois].sort((a, b) => {
    const da = new Date(a.renvoiDate).getTime()
    const db = new Date(b.renvoiDate).getTime()
    // "A renvoyer": oldest first (most urgent)
    if (status === "a_renvoyer") return da - db
    // Others: newest first
    return db - da
  })
}

export function KanbanBoard({ renvois, trackingMap, onCardClick }: KanbanBoardProps) {
  // Group renvois by status
  const grouped: Record<RenvoiStatus, Renvoi[]> = {
    a_renvoyer: [],
    expedie: [],
    livre: [],
  }
  for (const r of renvois) {
    if (grouped[r.status]) {
      grouped[r.status].push(r)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          label={col.label}
          icon={col.icon}
          color={col.color}
          bgColor={col.bgColor}
          renvois={sortRenvois(grouped[col.status], col.status)}
          trackingMap={trackingMap}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  )
}
