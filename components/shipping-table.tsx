"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ArrowUpDown, ExternalLink, Copy, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { EnrichedOrder, LaPosteTracking, Segment, ShippingThresholds, ShippingStatus } from "@/lib/types"
import { formatDateFR, getCountryFlag, getShippingStatusConfig, deriveShippingStatus } from "@/lib/shipping-utils"
import { getSegmentColor } from "@/lib/segments"

type SortKey = "orderName" | "customerName" | "countryCode" | "shippedAt" | "businessDaysElapsed" | "alertLevel"
type SortDirection = "asc" | "desc"

interface ShippingTableProps {
  orders: EnrichedOrder[]
  trackingMap: Record<string, LaPosteTracking>
  onSelectOrder: (order: EnrichedOrder) => void
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  segments: Segment[]
  orderNotes?: Record<string, string>
  thresholds: ShippingThresholds
}

const statusSortOrder: Record<ShippingStatus, number> = {
  problem: 0,
  returned: 1,
  delayed: 2,
  out_for_delivery: 3,
  in_transit: 4,
  pickup_ready: 5,
  delivered: 6,
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

function DurationBar({ days, effectiveStatus, threshold }: { days: number; effectiveStatus: ShippingStatus; threshold: number }) {
  const pct = Math.min((days / (threshold * 2)) * 100, 100)
  // Delivered / pickup_ready / out_for_delivery → always green (no alert)
  const isOk = effectiveStatus === "delivered" || effectiveStatus === "pickup_ready" || effectiveStatus === "out_for_delivery"
  const isDelayed = !isOk && (effectiveStatus === "delayed" || effectiveStatus === "problem" || effectiveStatus === "returned")
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm tabular-nums", isDelayed ? "text-[#C70A24] font-medium" : "text-foreground")}>{days}j</span>
      <div className="w-14 h-1 rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full",
            isOk ? "bg-[#047B5D]" : isDelayed ? "bg-[#C70A24]" : days >= threshold ? "bg-[#E67C00]" : "bg-[#047B5D]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ShippingTable({ orders, trackingMap, onSelectOrder, selectedIds, onSelectionChange, segments, orderNotes = {}, thresholds }: ShippingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("alertLevel")
  const [sortDir, setSortDir] = useState<SortDirection>("asc")
  const [page, setPage] = useState(0)
  const perPage = 20

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  // Derive effective status — La Poste is the single source of truth
  const getEffectiveStatus = useCallback((order: EnrichedOrder): ShippingStatus => {
    const lp = order.trackingNumber ? trackingMap[order.trackingNumber] : undefined
    return deriveShippingStatus(
      lp?.statusSummary,
      order.businessDaysElapsed,
      order.countryCode,
      thresholds
    )
  }, [trackingMap, thresholds])

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      let cmp = 0
      if (sortKey === "alertLevel") {
        const statusA = getEffectiveStatus(a)
        const statusB = getEffectiveStatus(b)
        cmp = statusSortOrder[statusA] - statusSortOrder[statusB]
      } else if (sortKey === "businessDaysElapsed") {
        cmp = a.businessDaysElapsed - b.businessDaysElapsed
      } else if (sortKey === "shippedAt") {
        cmp = new Date(a.shippedAt).getTime() - new Date(b.shippedAt).getTime()
      } else {
        cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "")
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [orders, sortKey, sortDir, getEffectiveStatus])

  const totalPages = Math.ceil(sorted.length / perPage)
  const paginated = sorted.slice(page * perPage, (page + 1) * perPage)

  const orderSegments = useMemo(() => {
    const map: Record<string, Segment[]> = {}
    for (const seg of segments) {
      for (const oid of seg.orderIds) {
        if (!map[oid]) map[oid] = []
        map[oid].push(seg)
      }
    }
    return map
  }, [segments])

  const allPageSelected = paginated.length > 0 && paginated.every((o) => selectedIds.has(o.id))
  const somePageSelected = paginated.some((o) => selectedIds.has(o.id))

  function toggleAll() {
    const next = new Set(selectedIds)
    if (allPageSelected) {
      for (const o of paginated) next.delete(o.id)
    } else {
      for (const o of paginated) next.add(o.id)
    }
    onSelectionChange(next)
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  // --- Drag-select (like Google Sheets) ---
  const dragRef = useRef<{ active: boolean; action: "select" | "deselect"; ids: Set<string> } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = useCallback((id: string) => {
    const willSelect = !selectedIds.has(id)
    const next = new Set(selectedIds)
    if (willSelect) next.add(id)
    else next.delete(id)
    dragRef.current = { active: true, action: willSelect ? "select" : "deselect", ids: next }
    setIsDragging(true)
    onSelectionChange(next)
  }, [selectedIds, onSelectionChange])

  const handleDragEnter = useCallback((id: string) => {
    if (!dragRef.current?.active) return
    const next = new Set(dragRef.current.ids)
    if (dragRef.current.action === "select") next.add(id)
    else next.delete(id)
    dragRef.current.ids = next
    onSelectionChange(next)
  }, [onSelectionChange])

  const handleDragEnd = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null
      setIsDragging(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("mouseup", handleDragEnd)
    return () => window.removeEventListener("mouseup", handleDragEnd)
  }, [handleDragEnd])

  function SortHeader({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) {
    return (
      <TableHead
        className={cn("cursor-pointer select-none hover:text-foreground", className)}
        onClick={() => toggleSort(sortKeyName)}
      >
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={cn("h-3 w-3", sortKey === sortKeyName ? "text-foreground" : "text-muted-foreground/30")} />
        </span>
      </TableHead>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-base font-medium">Aucune commande trouvée</p>
        <p className="text-sm mt-1">Essayez de modifier vos filtres ou votre période</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={cn("rounded-lg border border-border overflow-hidden bg-card shadow-[0_1px_0_0_rgba(0,0,0,.05)]", isDragging && "select-none")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <SortHeader label="Commande" sortKeyName="orderName" />
              <SortHeader label="Client" sortKeyName="customerName" />
              <SortHeader label="Pays" sortKeyName="countryCode" />
              <SortHeader label="Expédié" sortKeyName="shippedAt" />
              <SortHeader label="Durée" sortKeyName="businessDaysElapsed" />
              <TableHead>Tracking</TableHead>
              <SortHeader label="Statut" sortKeyName="alertLevel" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((order) => {
              const tracking = order.trackingNumber
                ? trackingMap[order.trackingNumber]
                : undefined
              const effectiveStatus = getEffectiveStatus(order)
              const statusConfig = getShippingStatusConfig(effectiveStatus)
              const threshold = order.countryCode === "BE" ? thresholds.be : thresholds.fr
              const isSelected = selectedIds.has(order.id)
              const segs = orderSegments[order.id] ?? []
              const orderNote = orderNotes[order.id] || ""
              const segNotes = segs.map((s) => s.notes[order.id]).filter(Boolean)
              const notePreview = orderNote || segNotes[0] || ""

              return (
                <TableRow
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className={cn(
                    "cursor-pointer group",
                    (effectiveStatus === "delayed" || effectiveStatus === "problem" || effectiveStatus === "returned") && "delayed-row",
                    isSelected && "bg-[#F3E8FF]"
                  )}
                >
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleDragStart(order.id)
                    }}
                    onMouseEnter={() => handleDragEnter(order.id)}
                    className="cursor-pointer"
                  >
                    <Checkbox
                      checked={isSelected}
                      tabIndex={-1}
                      className="pointer-events-none"
                      aria-label={`Sélectionner ${order.orderName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{order.orderName}</span>
                      {segs.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          {segs.map((s) => (
                            <div
                              key={s.id}
                              className={cn("w-2 h-2 rounded-full", getSegmentColor(s.color).dot)}
                              title={s.name}
                            />
                          ))}
                        </div>
                      )}
                      {notePreview && (
                        <Tooltip>
                          <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center w-5 h-5 rounded bg-[#FFF1E3] cursor-default">
                              <StickyNote className="h-3 w-3 text-[#8A6116]" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-64 text-[13px]">
                            <p className="whitespace-pre-wrap">{notePreview}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                        style={getAvatarStyle(order.customerName)}
                      >
                        {getInitials(order.customerName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{order.customerName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{order.customerEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{getCountryFlag(order.countryCode)} {order.countryCode}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateFR(order.shippedAt)}</TableCell>
                  <TableCell>
                    <DurationBar days={order.businessDaysElapsed} effectiveStatus={effectiveStatus} threshold={threshold} />
                  </TableCell>
                  <TableCell>
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#005BD3] hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        Suivre <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Badge variant="outline" className={cn("text-[10px] font-medium cursor-default", statusConfig.badgeClassName)}>
                            {statusConfig.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-64 text-[12px]">
                          {tracking ? (
                            <>
                              <p>{tracking.lastEventLabel}</p>
                              {tracking.lastEventDate && (
                                <p className="text-[11px] opacity-70 mt-0.5">
                                  {new Date(tracking.lastEventDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </>
                          ) : (
                            <p>{order.businessDaysElapsed}j ouvrés depuis l&apos;expédition</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(order.customerEmail)
                          toast.success("Email copié")
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        title="Copier email"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {page * perPage + 1}–{Math.min((page + 1) * perPage, sorted.length)} sur {sorted.length}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-[13px] rounded-md border border-border bg-card text-foreground disabled:opacity-30 hover:bg-secondary transition-colors"
            >
              Préc
            </button>
            <span className="px-3 py-1.5 text-[13px] text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-[13px] rounded-md border border-border bg-card text-foreground disabled:opacity-30 hover:bg-secondary transition-colors"
            >
              Suiv
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
