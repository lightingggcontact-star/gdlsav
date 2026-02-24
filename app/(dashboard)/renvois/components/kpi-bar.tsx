"use client"

import { RotateCcw, Euro, CalendarDays } from "lucide-react"
import type { Renvoi } from "@/lib/types"

function KpiCard({
  icon: Icon,
  label,
  value,
  color = "#007AFF",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

export function KpiBar({ renvois }: { renvois: Renvoi[] }) {
  const now = new Date()
  const thisMonth = renvois.filter((r) => {
    const d = new Date(r.renvoiDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const totalCost = renvois
    .reduce((sum, r) => sum + parseFloat(r.orderTotal || "0"), 0)
    .toLocaleString("fr-FR", { style: "currency", currency: "EUR" })

  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard icon={RotateCcw} label="Total renvois" value={renvois.length} color="#007AFF" />
      <KpiCard icon={Euro} label="Cout total" value={totalCost} color="#C70A24" />
      <KpiCard icon={CalendarDays} label="Ce mois-ci" value={thisMonth} color="#8B5CF6" />
    </div>
  )
}
