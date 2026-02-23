"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ShippingStats } from "@/components/stat-cards"
import {
  ShippingFilters,
  type AlertFilter,
  type CountryFilter,
} from "@/components/shipping-filters"
import { ShippingTable } from "@/components/shipping-table"
import { ShippingDetailPanel } from "@/components/shipping-detail-panel"
import { SegmentActionBar } from "@/components/segment-action-bar"
import { CreateSegmentDialog } from "@/components/create-segment-dialog"
import type { EnrichedOrder, LaPosteTracking, Segment } from "@/lib/types"
import { getSegments, getOrderNotes } from "@/lib/segments"
import { useSupabase } from "@/lib/supabase/use-supabase"
import type { DateRange } from "react-day-picker"

interface ShippingResponse {
  orders: EnrichedOrder[]
  stats: {
    total: number
    delayed: number
    inTransit: number
    delivered: number
  }
  fetchedAt: string
}

export default function ShippingPage() {
  const supabase = useSupabase()
  const [data, setData] = useState<ShippingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all")
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [segmentFilter, setSegmentFilter] = useState<string>("all")

  // Detail panel
  const [selectedOrder, setSelectedOrder] = useState<EnrichedOrder | null>(null)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Segments
  const [segments, setSegments] = useState<Segment[]>([])
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({})

  // La Poste tracking data
  const [trackingMap, setTrackingMap] = useState<Record<string, LaPosteTracking>>({})
  const [trackingLoading, setTrackingLoading] = useState(false)

  // Load segments and notes from Supabase
  const reloadSegments = useCallback(async () => {
    const [segs, notes] = await Promise.all([getSegments(supabase), getOrderNotes(supabase)])
    setSegments(segs)
    setOrderNotes(notes)
  }, [supabase])

  useEffect(() => {
    reloadSegments()
  }, [reloadSegments])

  const fetchData = useCallback(async (range?: DateRange | undefined, force = false) => {
    try {
      const { data: settings } = await supabase
        .from("settings")
        .select("threshold_fr, threshold_be")
        .single()

      const thresholdFR = String(settings?.threshold_fr ?? 3)
      const thresholdBE = String(settings?.threshold_be ?? 5)

      const params = new URLSearchParams({ thresholdFR, thresholdBE })
      if (force) params.set("force", "true")

      if (range?.from) {
        params.set("startDate", format(range.from, "yyyy-MM-dd"))
        if (range.to) {
          params.set("endDate", format(range.to, "yyyy-MM-dd"))
        }
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)

      const res = await fetch(`/api/shipping?${params}`, { signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? "Erreur serveur")
      }

      const json: ShippingResponse = await res.json()
      setData(json)
      setError(null)
      return json
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Timeout — la requête a pris trop de temps")
      } else {
        setError(err instanceof Error ? err.message : "Erreur inconnue")
      }
      return null
    }
  }, [supabase])

  const fetchAllTracking = useCallback(async (orders: EnrichedOrder[]) => {
    const trackingNumbers = orders
      .filter((o) => o.trackingNumber)
      .map((o) => o.trackingNumber!)
      .filter((num, i, arr) => arr.indexOf(num) === i)

    if (trackingNumbers.length === 0) return

    setTrackingLoading(true)
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: trackingNumbers }),
      })
      if (res.ok) {
        const json = await res.json()
        const map: Record<string, LaPosteTracking> = {}
        for (const t of json.tracking) {
          map[t.trackingNumber] = t
        }
        setTrackingMap(map)
      }
    } catch {
      // Silently fail
    } finally {
      setTrackingLoading(false)
    }
  }, [])

  const fetchSingleTracking = useCallback(async (trackingNumber: string) => {
    try {
      const res = await fetch(`/api/tracking?numbers=${trackingNumber}`)
      if (res.ok) {
        const json = await res.json()
        if (json.tracking?.[0]) {
          setTrackingMap((prev) => ({
            ...prev,
            [trackingNumber]: json.tracking[0],
          }))
        }
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchData(dateRange)
      .then((result) => {
        if (result?.orders) {
          fetchAllTracking(result.orders)
        }
      })
      .finally(() => setLoading(false))
  }, [fetchData, fetchAllTracking, dateRange])

  async function handleRefresh() {
    setRefreshing(true)
    const result = await fetchData(dateRange, true)
    setRefreshing(false)
    if (result?.orders) {
      fetchAllTracking(result.orders)
    }
  }

  function handleDateRangeChange(range: DateRange | undefined) {
    setDateRange(range)
  }

  function handleSelectOrder(order: EnrichedOrder) {
    setSelectedOrder(order)
    if (order.trackingNumber) {
      fetchSingleTracking(order.trackingNumber)
    }
  }

  // Derive effective status: La Poste when available, fallback to Shopify
  const getEffectiveStatus = useCallback((order: EnrichedOrder): "delayed" | "in_transit" | "delivered" => {
    const lp = order.trackingNumber ? trackingMap[order.trackingNumber] : undefined
    if (lp && lp.statusSummary !== "unknown") {
      if (lp.statusSummary === "delivered") return "delivered"
      if (lp.statusSummary === "problem" || lp.statusSummary === "returned") return "delayed"
      return "in_transit"
    }
    return order.alertLevel
  }, [trackingMap])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!data) return []

    // Segment filter: get order IDs in selected segment
    const segOrderIds = segmentFilter !== "all"
      ? new Set(segments.find((s) => s.id === segmentFilter)?.orderIds ?? [])
      : null

    return data.orders.filter((order) => {
      if (alertFilter !== "all" && getEffectiveStatus(order) !== alertFilter) return false
      if (countryFilter !== "all" && order.countryCode !== countryFilter) return false
      if (segOrderIds && !segOrderIds.has(order.id)) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          order.orderName.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.customerEmail.toLowerCase().includes(q)
        )
      }

      return true
    })
  }, [data, alertFilter, countryFilter, searchQuery, segmentFilter, segments, getEffectiveStatus])

  // Filtered stats — use La Poste status when available, fallback to Shopify alertLevel
  const filteredStats = useMemo(() => {
    let delayed = 0
    let inTransit = 0
    let delivered = 0

    for (const o of filteredOrders) {
      const lp = o.trackingNumber ? trackingMap[o.trackingNumber] : undefined
      if (lp && lp.statusSummary !== "unknown") {
        if (lp.statusSummary === "delivered") delivered++
        else if (lp.statusSummary === "problem" || lp.statusSummary === "returned") delayed++
        else inTransit++
      } else {
        if (o.alertLevel === "delivered") delivered++
        else if (o.alertLevel === "delayed") delayed++
        else inTransit++
      }
    }

    return { total: filteredOrders.length, delayed, inTransit, delivered }
  }, [filteredOrders, trackingMap])

  if (loading) {
    return (
      <div className="space-y-6 ">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Suivi Livraisons</h1>
        <div className="rounded-lg border border-border bg-[#FEE8EB] p-8 text-center">
          <p className="text-[#C70A24] font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-4 bg-card"
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchData(dateRange).finally(() => setLoading(false))
            }}
          >
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Suivi Livraisons
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {data?.fetchedAt && (
              <p className="text-xs text-muted-foreground">
                Mis à jour {new Date(data.fetchedAt).toLocaleTimeString("fr-FR")}
              </p>
            )}
            {trackingLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-gdl-purple">
                <span className="w-1.5 h-1.5 rounded-full bg-gdl-purple animate-pulse" />
                Chargement La Poste...
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2 border-border"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Rafraîchir
        </Button>
      </div>

      {/* Stats */}
      <ShippingStats stats={filteredStats} />

      {/* Filters */}
      <ShippingFilters
        alertFilter={alertFilter}
        countryFilter={countryFilter}
        searchQuery={searchQuery}
        dateRange={dateRange}
        counts={filteredStats}
        segments={segments}
        segmentFilter={segmentFilter}
        onAlertFilterChange={setAlertFilter}
        onCountryFilterChange={setCountryFilter}
        onSearchChange={setSearchQuery}
        onDateRangeChange={handleDateRangeChange}
        onSegmentFilterChange={setSegmentFilter}
        onSegmentsChange={reloadSegments}
      />

      {/* Table */}
      <ShippingTable
        orders={filteredOrders}
        trackingMap={trackingMap}
        onSelectOrder={handleSelectOrder}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        segments={segments}
        orderNotes={orderNotes}
      />

      {/* Detail panel */}
      <ShippingDetailPanel
        order={selectedOrder}
        tracking={selectedOrder?.trackingNumber ? trackingMap[selectedOrder.trackingNumber] : undefined}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        segments={segments}
        onSegmentsChange={reloadSegments}
      />

      {/* Selection action bar */}
      <SegmentActionBar
        selectedCount={selectedIds.size}
        selectedIds={selectedIds}
        segments={segments}
        onClearSelection={() => setSelectedIds(new Set())}
        onCreateSegment={() => setShowCreateDialog(true)}
        onSegmentsChange={reloadSegments}
      />

      {/* Create segment dialog */}
      <CreateSegmentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        selectedIds={selectedIds}
        onCreated={() => {
          reloadSegments()
          setSelectedIds(new Set())
        }}
      />
    </div>
  )
}
