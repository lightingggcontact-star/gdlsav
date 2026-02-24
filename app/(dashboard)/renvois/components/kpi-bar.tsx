"use client"

import { Clock, Truck, CircleCheck, Euro } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Renvoi } from "@/lib/types"

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subtitle?: string
  iconBg: string
  iconColor: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
        </div>
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function KpiBar({ renvois }: { renvois: Renvoi[] }) {
  const aRenvoyer = renvois.filter((r) => r.status === "a_renvoyer").length
  const expedies = renvois.filter((r) => r.status === "expedie").length
  const livres = renvois.filter((r) => r.status === "livre").length

  const now = new Date()
  const thisMonth = renvois.filter((r) => {
    const d = new Date(r.renvoiDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const coutMois = thisMonth
    .reduce((sum, r) => sum + parseFloat(r.orderTotal || "0"), 0)
    .toLocaleString("fr-FR", { style: "currency", currency: "EUR" })

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={Clock}
        label="A renvoyer"
        value={aRenvoyer}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-600"
      />
      <KpiCard
        icon={Truck}
        label="Expedies"
        value={expedies}
        iconBg="bg-blue-500/10"
        iconColor="text-blue-600"
      />
      <KpiCard
        icon={CircleCheck}
        label="Livres"
        value={livres}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-600"
      />
      <KpiCard
        icon={Euro}
        label="Cout ce mois"
        value={coutMois}
        subtitle={`${thisMonth.length} renvoi${thisMonth.length > 1 ? "s" : ""}`}
        iconBg="bg-red-500/10"
        iconColor="text-red-600"
      />
    </div>
  )
}
