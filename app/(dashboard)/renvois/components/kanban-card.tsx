"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { getReasonEmoji, getReasonLabel } from "@/lib/renvois"
import type { Renvoi, LaPosteTracking } from "@/lib/types"

const REASON_BORDER: Record<string, string> = {
  colis_perdu: "border-l-amber-500",
  colis_endommage: "border-l-red-500",
  erreur_preparation: "border-l-orange-500",
  retour_client: "border-l-blue-500",
  autre: "border-l-gray-400",
}

const LP_BADGE: Record<string, { label: string; cls: string }> = {
  delivered: { label: "Livre", cls: "text-emerald-600 bg-emerald-500/10" },
  in_transit: { label: "En transit", cls: "text-blue-600 bg-blue-500/10" },
  out_for_delivery: { label: "En livraison", cls: "text-blue-600 bg-blue-500/10" },
  pickup_ready: { label: "Pt relais", cls: "text-violet-600 bg-violet-500/10" },
  problem: { label: "Probleme", cls: "text-orange-600 bg-orange-500/10" },
  returned: { label: "Retourne", cls: "text-purple-600 bg-purple-500/10" },
  delayed: { label: "Retard", cls: "text-red-600 bg-red-500/10" },
}

function formatCurrency(amount: string): string {
  const n = parseFloat(amount)
  if (isNaN(n)) return "0,00 \u20AC"
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return "Hier"
  if (diffDays < 7) return `il y a ${diffDays}j`
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

interface KanbanCardProps {
  renvoi: Renvoi
  tracking?: LaPosteTracking
  onClick: () => void
}

export const KanbanCard = React.memo(function KanbanCard({
  renvoi,
  tracking,
  onClick,
}: KanbanCardProps) {
  const borderColor = REASON_BORDER[renvoi.reason] ?? "border-l-gray-400"
  const lpStatus = tracking?.statusSummary
  const lpBadge = lpStatus && lpStatus !== "unknown" ? LP_BADGE[lpStatus] : null
  const needsTracking = renvoi.status === "a_renvoyer" && !renvoi.trackingNumber

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border border-l-[3px] bg-card p-3 cursor-pointer",
        "hover:shadow-md transition-shadow select-none",
        borderColor,
      )}
    >
      {/* Row 1: order + price */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{renvoi.orderName}</span>
        <span className="text-[12px] font-medium text-[#007AFF]">{formatCurrency(renvoi.orderTotal)}</span>
      </div>

      {/* Row 2: customer + date */}
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-[12px] text-muted-foreground truncate flex-1">{renvoi.customerName}</p>
        <span className="text-[10px] text-muted-foreground/60 ml-2 shrink-0">{relativeDate(renvoi.renvoiDate)}</span>
      </div>

      {/* Row 3: reason */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-[13px]">{getReasonEmoji(renvoi.reason)}</span>
        <span className="text-[11px] text-muted-foreground">{getReasonLabel(renvoi.reason)}</span>
      </div>

      {/* Row 4: tracking or "ajouter tracking" hint */}
      {renvoi.trackingNumber ? (
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] font-mono text-muted-foreground truncate max-w-30">
            {renvoi.trackingNumber}
          </span>
          {lpBadge && (
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", lpBadge.cls)}>
              {lpBadge.label}
            </span>
          )}
        </div>
      ) : needsTracking ? (
        <div className="mt-2 text-[11px] text-amber-600 font-medium">
          Ajouter le numero de suivi →
        </div>
      ) : null}

      {/* Row 5: note preview */}
      {renvoi.note && (
        <p className="text-[11px] text-muted-foreground/80 italic mt-1.5 line-clamp-1">
          &ldquo;{renvoi.note.slice(0, 60)}{renvoi.note.length > 60 ? "..." : ""}&rdquo;
        </p>
      )}
    </div>
  )
})
