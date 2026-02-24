"use client"

import { type LucideIcon, AlertTriangle, Clock, Truck, PackageCheck, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: number
  total: number
  icon: LucideIcon
  color: "red" | "yellow" | "green" | "neutral" | "blue" | "orange"
  subtitle?: string
}

const colorConfig = {
  red: {
    iconBg: "bg-[#FEE8EB]",
    iconColor: "text-[#C70A24]",
    valueColor: "text-[#C70A24]",
    progressBg: "bg-[#FEE8EB]",
    progressFill: "bg-[#C70A24]",
  },
  yellow: {
    iconBg: "bg-[#FFF1E3]",
    iconColor: "text-[#8A6116]",
    valueColor: "text-[#8A6116]",
    progressBg: "bg-[#FFF1E3]",
    progressFill: "bg-[#E67C00]",
  },
  green: {
    iconBg: "bg-[#CDFED4]",
    iconColor: "text-[#047B5D]",
    valueColor: "text-[#047B5D]",
    progressBg: "bg-[#CDFED4]",
    progressFill: "bg-[#047B5D]",
  },
  blue: {
    iconBg: "bg-[#EAF4FF]",
    iconColor: "text-[#005BD3]",
    valueColor: "text-[#005BD3]",
    progressBg: "bg-[#EAF4FF]",
    progressFill: "bg-[#005BD3]",
  },
  orange: {
    iconBg: "bg-[#FFF1E3]",
    iconColor: "text-[#E67C00]",
    valueColor: "text-[#E67C00]",
    progressBg: "bg-[#FFF1E3]",
    progressFill: "bg-[#E67C00]",
  },
  neutral: {
    iconBg: "bg-secondary",
    iconColor: "text-muted-foreground",
    valueColor: "text-foreground",
    progressBg: "bg-secondary",
    progressFill: "bg-muted-foreground",
  },
}

function StatCard({ label, value, total, icon: Icon, color, subtitle }: StatCardProps) {
  const config = colorConfig[color]
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const barWidth = total > 0 ? Math.max((value / total) * 100, 2) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("rounded-md p-2", config.iconBg)}>
          <Icon className={cn("h-4 w-4", config.iconColor)} />
        </div>
        {color !== "neutral" && total > 0 && (
          <span className="text-xs text-muted-foreground">{pct}%</span>
        )}
      </div>
      <p className={cn("text-2xl font-semibold", config.valueColor)}>{value}</p>
      <p className="text-[13px] text-muted-foreground mt-0.5">{label}</p>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
      )}
      {color !== "neutral" && (
        <div className={cn("mt-3 h-1 rounded-full", config.progressBg)}>
          <div
            className={cn("h-full rounded-full transition-all duration-500", config.progressFill)}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  )
}

// === Shipping Stats ===

export interface ShippingStatsData {
  total: number
  delivered: number
  pickup_ready: number
  out_for_delivery: number
  in_transit: number
  delayed: number
  problem: number
  returned: number
}

interface ShippingStatsProps {
  stats: ShippingStatsData
}

function buildSubtitle(parts: { count: number; label: string }[]): string {
  return parts.filter((p) => p.count > 0).map((p) => `${p.count} ${p.label}`).join(", ")
}

export function ShippingStats({ stats }: ShippingStatsProps) {
  const actionNeeded = stats.problem + stats.returned
  const inProgress = stats.in_transit + stats.out_for_delivery + stats.pickup_ready

  const actionSubtitle = buildSubtitle([
    { count: stats.problem, label: "probl." },
    { count: stats.returned, label: "retours" },
  ])

  const progressSubtitle = buildSubtitle([
    { count: stats.in_transit, label: "transit" },
    { count: stats.out_for_delivery, label: "livraison" },
    { count: stats.pickup_ready, label: "retrait" },
  ])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <StatCard label="A traiter" value={actionNeeded} total={stats.total} icon={AlertTriangle} color="red" subtitle={actionSubtitle} />
      <StatCard label="En retard" value={stats.delayed} total={stats.total} icon={Clock} color="orange" />
      <StatCard label="En cours" value={inProgress} total={stats.total} icon={Truck} color="blue" subtitle={progressSubtitle} />
      <StatCard label="Livrés" value={stats.delivered} total={stats.total} icon={PackageCheck} color="green" />
      <StatCard label="Total" value={stats.total} total={stats.total} icon={BarChart3} color="neutral" />
    </div>
  )
}
