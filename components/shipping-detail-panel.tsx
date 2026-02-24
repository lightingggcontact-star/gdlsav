"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, ExternalLink, Mail, Loader2, Package, AlertTriangle, RotateCcw, CheckCircle2, Circle, MapPin, Truck as TruckIcon, AlertOctagon, X, StickyNote } from "lucide-react"
import type { EnrichedOrder, LaPosteTracking, Segment, ShippingStatus } from "@/lib/types"
import {
  formatDateFR,
  getShipmentStatusLabel,
  getCountryFlag,
  getShippingStatusConfig,
} from "@/lib/shipping-utils"
import { getSegmentColor, removeOrderFromSegment, setNote, getOrderNote, setOrderNote } from "@/lib/segments"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { cn } from "@/lib/utils"

interface ShippingDetailPanelProps {
  order: EnrichedOrder | null
  tracking?: LaPosteTracking
  effectiveStatus?: ShippingStatus
  open: boolean
  onClose: () => void
  segments?: Segment[]
  onSegmentsChange?: () => void
}

const statusIconMap: Record<ShippingStatus, typeof CheckCircle2> = {
  delivered: CheckCircle2,
  pickup_ready: MapPin,
  out_for_delivery: TruckIcon,
  in_transit: Package,
  delayed: AlertTriangle,
  problem: AlertOctagon,
  returned: RotateCcw,
}

function formatTrackingDate(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
}

function getAvatarStyle(name: string): React.CSSProperties {
  const palettes = [
    { bg: "#E3D0FF", fg: "#007AFF" },
    { bg: "#D0E8FF", fg: "#005BD3" },
    { bg: "#FFE0D0", fg: "#C4320A" },
    { bg: "#D0FFE0", fg: "#047B5D" },
    { bg: "#FFD0E8", fg: "#C70A24" },
    { bg: "#D0F0FF", fg: "#006D75" },
    { bg: "#FFF0D0", fg: "#8A6116" },
    { bg: "#E8D0FF", fg: "#007AFF" },
  ]
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  const p = palettes[Math.abs(hash) % palettes.length]
  return { backgroundColor: p.bg, color: p.fg }
}

function SegmentNoteEditor({
  segment,
  orderId,
  onSegmentsChange,
}: {
  segment: Segment
  orderId: string
  onSegmentsChange: () => void
}) {
  const supabase = useSupabase()
  const [note, setNoteText] = useState(segment.notes[orderId] ?? "")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const color = getSegmentColor(segment.color)

  const save = useCallback((value: string) => {
    setNote(supabase, segment.id, orderId, value).then(() => onSegmentsChange())
  }, [supabase, segment.id, orderId, onSegmentsChange])

  function handleChange(value: string) {
    setNoteText(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 600)
  }

  function handleBlur() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    save(note)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function handleRemove() {
    removeOrderFromSegment(supabase, segment.id, orderId).then(() => {
      onSegmentsChange()
      toast.success("Commande retirée du segment")
    })
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", color.dot)} />
          <span className="text-[13px] font-medium">{segment.name}</span>
        </div>
        <button
          onClick={handleRemove}
          className="text-muted-foreground hover:text-[#E51C00] transition-colors"
          title="Retirer du segment"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Ajouter une note..."
        className="w-full text-[13px] bg-background border border-border rounded-md px-3 py-2 resize-none h-14 focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

const QUICK_NOTES = ["Averti", "Renvoi", "Remboursé", "En attente", "Récla client", "Perdu"]

function OrderNoteEditor({ orderId }: { orderId: string }) {
  const supabase = useSupabase()
  const [note, setNoteLocal] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getOrderNote(supabase, orderId).then(setNoteLocal)
  }, [supabase, orderId])

  function handleChange(value: string) {
    setNoteLocal(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOrderNote(supabase, orderId, value), 600)
  }

  function handleBlur() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setOrderNote(supabase, orderId, note)
  }

  function addQuick(tag: string) {
    const sep = note.trim() ? " + " : ""
    const next = note.trim() + sep + tag
    setNoteLocal(next)
    setOrderNote(supabase, orderId, next)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_NOTES.map((tag) => (
          <button
            key={tag}
            onClick={() => addQuick(tag)}
            className="px-2 py-0.5 rounded-md bg-secondary text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Ajouter une note..."
        rows={2}
        className="w-full text-[13px] bg-background border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

export function ShippingDetailPanel({
  order,
  tracking,
  effectiveStatus,
  open,
  onClose,
  segments = [],
  onSegmentsChange,
}: ShippingDetailPanelProps) {
  if (!order) return null

  const status = effectiveStatus ?? order.alertLevel
  const statusConfig = getShippingStatusConfig(status)
  const StatusIcon = statusIconMap[status] ?? Circle
  const orderSegments = segments.filter((s) => s.orderIds.includes(order.id))

  function copyEmail() {
    navigator.clipboard.writeText(order!.customerEmail)
    toast.success("Email copié")
  }

  const shopifyNumericId = order.id.split("/").pop()
  const shopifyAdminUrl = `https://admin.shopify.com/store/grainedelascars/orders/${shopifyNumericId}`

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <SheetHeader className="mb-0">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={getAvatarStyle(order.customerName)}
              >
                {getInitials(order.customerName)}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base">{order.customerName}</SheetTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground">{order.orderName}</span>
                  <Badge variant="outline" className={cn("text-[10px] font-medium", statusConfig.badgeClassName)}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
              <span className="text-lg font-semibold text-foreground">{order.totalPrice}&euro;</span>
            </div>
          </SheetHeader>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-6 h-10">
            <TabsTrigger value="details" className="text-xs data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-foreground">
              Détails
            </TabsTrigger>
            <TabsTrigger value="tracking" className="text-xs data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-foreground">
              Suivi La Poste
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-foreground">
              Actions
            </TabsTrigger>
          </TabsList>

          {/* Details tab */}
          <TabsContent value="details" className="p-6 space-y-5 mt-0">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <StickyNote className="h-3 w-3" />
                Note
              </h3>
              <OrderNoteEditor orderId={order.id} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-[12px] gap-1.5" asChild>
                <a href={shopifyAdminUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Shopify
                </a>
              </Button>
              {order.trackingUrl && (
                <Button variant="outline" size="sm" className="flex-1 h-8 text-[12px] gap-1.5" asChild>
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                    <Package className="h-3 w-3" />
                    Suivre colis
                  </a>
                </Button>
              )}
            </div>

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Client</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{order.customerName}</span>
                  <span className="text-sm">{getCountryFlag(order.countryCode)} {order.countryCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{order.customerEmail}</span>
                  <button onClick={copyEmail} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Commande</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Montant</p>
                  <p className="text-sm font-medium mt-0.5">{order.totalPrice} &euro;</p>
                </div>
                <div className="rounded-md bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Expédié le</p>
                  <p className="text-sm font-medium mt-0.5">{formatDateFR(order.shippedAt)}</p>
                </div>
                <div className="rounded-md bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Jours ouvrés</p>
                  <p className="text-sm font-medium mt-0.5">{order.businessDaysElapsed}j</p>
                </div>
                <div className="rounded-md bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Statut Shopify</p>
                  <p className="text-sm font-medium mt-0.5">{getShipmentStatusLabel(order.shipmentStatus)}</p>
                </div>
              </div>
            </div>

            {order.trackingNumber && (
              <>
                <div className="h-px bg-border" />
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Tracking</h3>
                  <p className="text-sm font-mono bg-background px-3 py-2 rounded-md">{order.trackingNumber}</p>
                </div>
              </>
            )}

            {orderSegments.length > 0 && onSegmentsChange && (
              <>
                <div className="h-px bg-border" />
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3" />
                    Notes
                  </h3>
                  <div className="space-y-2">
                    {orderSegments.map((seg) => (
                      <SegmentNoteEditor
                        key={seg.id}
                        segment={seg}
                        orderId={order.id}
                        onSegmentsChange={onSegmentsChange}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Tracking tab */}
          <TabsContent value="tracking" className="p-6 space-y-4 mt-0">
            {!order.trackingNumber ? (
              <p className="text-sm text-muted-foreground text-center py-8">Pas de numéro de suivi</p>
            ) : !tracking ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement du suivi...
              </div>
            ) : tracking.error ? (
              <div className="rounded-md bg-background p-4 text-center">
                <p className="text-sm font-mono mb-1">{order.trackingNumber}</p>
                <p className="text-xs text-muted-foreground">{tracking.error}</p>
              </div>
            ) : (
              <>
                {/* Status banner */}
                <div className={cn("flex items-center gap-3 rounded-lg p-4", statusConfig.iconBg)}>
                  <StatusIcon className={cn("h-5 w-5", statusConfig.iconColor)} />
                  <div>
                    <p className={cn("font-medium text-sm", statusConfig.iconColor)}>{statusConfig.label}</p>
                    {tracking.lastEventLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">{tracking.lastEventLabel}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono">{order.trackingNumber}</p>
                  {tracking.shipment?.product && (
                    <Badge variant="secondary" className="text-xs">{tracking.shipment.product}</Badge>
                  )}
                </div>

                {tracking.shipment?.timeline && tracking.shipment.timeline.length > 0 && (
                  <div className="space-y-0">
                    {tracking.shipment.timeline.map((step) => (
                      <div key={step.id} className="flex items-start gap-3 py-2">
                        <div className="flex flex-col items-center mt-0.5">
                          <div className={cn(
                            "w-3 h-3 rounded-full border-2",
                            step.status
                              ? step.type === 1 ? "bg-[#047B5D] border-[#047B5D]"
                                : step.type === 0 ? "bg-[#E67C00] border-[#E67C00]"
                                  : "bg-[#E51C00] border-[#E51C00]"
                              : "bg-transparent border-border"
                          )} />
                          {step.id < 5 && (
                            <div className={cn("w-0.5 h-6", step.status ? "bg-[#047B5D]/30" : "bg-border")} />
                          )}
                        </div>
                        <div className="flex-1 -mt-0.5">
                          <p className={cn("text-sm", step.status ? "text-foreground font-medium" : "text-muted-foreground")}>
                            {step.shortLabel}
                          </p>
                          {step.date && <p className="text-xs text-muted-foreground">{formatTrackingDate(step.date)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tracking.shipment?.event && tracking.shipment.event.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Historique</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {tracking.shipment.event.map((evt, i) => (
                        <div key={i} className="flex gap-3 text-xs border-l-2 border-border pl-3 py-1">
                          <span className="text-muted-foreground whitespace-nowrap min-w-24">{formatTrackingDate(evt.date)}</span>
                          <span className="text-foreground flex-1">{evt.label}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">{evt.code}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Actions tab */}
          <TabsContent value="actions" className="p-6 space-y-4 mt-0">
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-3 h-10" onClick={copyEmail}>
                <Copy className="h-4 w-4" />
                Copier l&apos;email
              </Button>

              <Button variant="outline" className="w-full justify-start gap-3 h-10" asChild>
                <a href={shopifyAdminUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir dans Shopify
                </a>
              </Button>

              {order.trackingUrl && (
                <Button variant="outline" className="w-full justify-start gap-3 h-10" asChild>
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                    <Package className="h-4 w-4" />
                    Suivi transporteur
                  </a>
                </Button>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-3 h-10 opacity-40 cursor-not-allowed" disabled>
                    <Mail className="h-4 w-4" />
                    Envoyer mail retard
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gorgias — bientôt disponible</TooltipContent>
              </Tooltip>
            </div>

          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
