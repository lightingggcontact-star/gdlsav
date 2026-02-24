"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Package,
  Truck,
  Check,
  Clock,
  XCircle,
  ExternalLink,
  Save,
  PackageCheck,
  Trash2,
  Loader2,
  CircleCheck,
  AlertTriangle,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { getReasonLabel, getReasonEmoji, STATUS_OPTIONS } from "@/lib/renvois"
import type { Renvoi, RenvoiStatus, LaPosteTracking } from "@/lib/types"

// ─── La Poste status config ──────────────────────────
const LP_STATUS: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  delivered: { label: "Livre", icon: CircleCheck, bg: "bg-emerald-500/10", text: "text-emerald-600" },
  in_transit: { label: "En transit", icon: Truck, bg: "bg-blue-500/10", text: "text-blue-600" },
  out_for_delivery: { label: "En livraison", icon: Truck, bg: "bg-blue-500/10", text: "text-blue-600" },
  pickup_ready: { label: "Point relais", icon: Package, bg: "bg-violet-500/10", text: "text-violet-600" },
  problem: { label: "Probleme", icon: AlertTriangle, bg: "bg-orange-500/10", text: "text-orange-600" },
  returned: { label: "Retourne", icon: Undo2, bg: "bg-purple-500/10", text: "text-purple-600" },
  delayed: { label: "Retard", icon: Clock, bg: "bg-red-500/10", text: "text-red-600" },
  unknown: { label: "Inconnu", icon: Package, bg: "bg-secondary", text: "text-muted-foreground" },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(amount: string): string {
  const n = parseFloat(amount)
  if (isNaN(n)) return "0,00 €"
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

interface RenvoiDetailSheetProps {
  renvoi: Renvoi | null
  open: boolean
  onOpenChange: (open: boolean) => void
  tracking?: LaPosteTracking
  trackingLoading?: boolean
  onStatusChange: (id: string, status: RenvoiStatus) => void
  onTrackingChange: (id: string, tracking: string) => void
  onNoteChange: (id: string, note: string) => void
  onColisRevenuToggle: (id: string, value: boolean) => void
  onDelete: (id: string) => void
}

export function RenvoiDetailSheet({
  renvoi,
  open,
  onOpenChange,
  tracking,
  trackingLoading,
  onStatusChange,
  onTrackingChange,
  onNoteChange,
  onColisRevenuToggle,
  onDelete,
}: RenvoiDetailSheetProps) {
  const [editingTracking, setEditingTracking] = useState(false)
  const [trackingInput, setTrackingInput] = useState("")
  const [noteInput, setNoteInput] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when renvoi changes
  useEffect(() => {
    if (renvoi) {
      setTrackingInput(renvoi.trackingNumber)
      setNoteInput(renvoi.note)
      setEditingTracking(false)
    }
  }, [renvoi?.id, renvoi?.trackingNumber, renvoi?.note])

  // Auto-save note with debounce
  const saveNote = useCallback((value: string) => {
    if (!renvoi) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (value !== renvoi.note) {
        onNoteChange(renvoi.id, value)
      }
    }, 600)
  }, [renvoi, onNoteChange])

  function handleNoteChange(value: string) {
    setNoteInput(value)
    saveNote(value)
  }

  function saveTracking() {
    if (!renvoi) return
    onTrackingChange(renvoi.id, trackingInput)
    setEditingTracking(false)
  }

  if (!renvoi) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#007AFF]" />
            {renvoi.orderName}
          </SheetTitle>
          <SheetDescription>
            {renvoi.customerName}
            {renvoi.customerEmail && ` — ${renvoi.customerEmail}`}
            <br />
            {formatCurrency(renvoi.orderTotal)} · {formatDate(renvoi.renvoiDate)}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          {/* ─── Status pills ─── */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-2 block">Statut</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => {
                const isActive = renvoi.status === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => onStatusChange(renvoi.id, s.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors border",
                      isActive
                        ? cn(s.bg, s.text, "border-current")
                        : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary"
                    )}
                  >
                    {s.value === "en_cours" && <Clock className="h-3 w-3" />}
                    {s.value === "expedie" && <Truck className="h-3 w-3" />}
                    {s.value === "livre" && <Check className="h-3 w-3" />}
                    {s.value === "annule" && <XCircle className="h-3 w-3" />}
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─── Raison ─── */}
          <div className="flex items-center gap-2">
            <span className="text-[14px]">{getReasonEmoji(renvoi.reason)}</span>
            <span className="text-[13px] font-medium">{getReasonLabel(renvoi.reason)}</span>
          </div>

          {/* ─── Tracking ─── */}
          <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[12px] font-medium text-muted-foreground">Suivi du renvoi</span>
              </div>
              {!editingTracking && (
                <button
                  onClick={() => { setTrackingInput(renvoi.trackingNumber); setEditingTracking(true) }}
                  className="text-[11px] text-[#007AFF] hover:underline"
                >
                  {renvoi.trackingNumber ? "Modifier" : "Ajouter"}
                </button>
              )}
            </div>

            {editingTracking ? (
              <div className="flex items-center gap-2">
                <Input
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Numero de suivi..."
                  className="text-[13px] h-8 flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && saveTracking()}
                />
                <Button size="sm" onClick={saveTracking} className="h-8 px-2 bg-[#007AFF] hover:bg-[#0066DD]">
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingTracking(false)} className="h-8 px-2">
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className={cn("text-[13px]", renvoi.trackingNumber ? "font-mono" : "text-muted-foreground italic")}>
                  {renvoi.trackingNumber || "Pas encore de numero de suivi"}
                </p>
                {renvoi.trackingNumber && (
                  <a
                    href={`https://www.laposte.fr/outils/suivre-vos-envois?code=${renvoi.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* La Poste status */}
            {renvoi.trackingNumber && !editingTracking && (
              <>
                {trackingLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Chargement du suivi La Poste...
                  </div>
                ) : tracking ? (
                  <div className="space-y-2">
                    {/* Status badge */}
                    {(() => {
                      const cfg = LP_STATUS[tracking.statusSummary] ?? LP_STATUS.unknown
                      const StatusIcon = cfg.icon
                      return (
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold", cfg.bg, cfg.text)}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </div>
                      )
                    })()}
                    {/* Last event */}
                    {tracking.lastEventLabel && (
                      <p className="text-[12px] text-muted-foreground">
                        {tracking.lastEventLabel}
                        {tracking.lastEventDate && (
                          <span className="ml-1.5 text-[11px] opacity-70">
                            — {new Date(tracking.lastEventDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </p>
                    )}
                    {/* Timeline */}
                    {tracking.shipment?.timeline && tracking.shipment.timeline.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
                        {tracking.shipment.timeline.filter((s) => s.status).map((step) => (
                          <div key={step.id} className="text-[11px]">
                            <span className="font-medium">{step.shortLabel}</span>
                            {step.date && (
                              <span className="text-muted-foreground ml-1.5">
                                {new Date(step.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {tracking.error && !tracking.shipment && (
                      <p className="text-[11px] text-orange-500">{tracking.error}</p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* ─── Colis revenu ─── */}
          <button
            onClick={() => onColisRevenuToggle(renvoi.id, !renvoi.colisRevenu)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border p-3 transition-colors",
              renvoi.colisRevenu
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border hover:border-muted-foreground/30 hover:bg-secondary/50"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0",
              renvoi.colisRevenu
                ? "border-emerald-500 bg-emerald-500"
                : "border-muted-foreground/30"
            )}>
              {renvoi.colisRevenu && <Check className="h-3 w-3 text-white" />}
            </div>
            <div className="flex items-center gap-2">
              <PackageCheck className={cn("h-4 w-4", renvoi.colisRevenu ? "text-emerald-600" : "text-muted-foreground")} />
              <span className={cn("text-[13px] font-medium", renvoi.colisRevenu ? "text-emerald-600" : "text-muted-foreground")}>
                {renvoi.colisRevenu ? "Colis original revenu" : "Colis original pas encore revenu"}
              </span>
            </div>
          </button>

          {/* ─── Note (auto-save) ─── */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Note</label>
            <Textarea
              value={noteInput}
              onChange={(e) => handleNoteChange(e.target.value)}
              onBlur={() => {
                // Force save on blur
                if (debounceRef.current) clearTimeout(debounceRef.current)
                if (noteInput !== renvoi.note) {
                  onNoteChange(renvoi.id, noteInput)
                }
              }}
              placeholder="Contexte, details..."
              className="text-[13px] min-h-[80px]"
            />
          </div>

          {/* ─── Supprimer ─── */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Supprimer ce renvoi ?")) {
                onDelete(renvoi.id)
                onOpenChange(false)
              }
            }}
            className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer ce renvoi
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
