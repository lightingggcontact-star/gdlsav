"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useSupabase } from "@/lib/supabase/use-supabase"
import {
  getRenvois,
  updateRenvoiStatus,
  updateRenvoiTracking,
  updateRenvoiNote,
  updateRenvoiColisRevenu,
  deleteRenvoi,
  REASON_OPTIONS,
  getStatusOption,
} from "@/lib/renvois"
import type { Renvoi, RenvoiStatus, LaPosteTracking } from "@/lib/types"
import { toast } from "sonner"

import { KpiBar } from "./components/kpi-bar"
import { KanbanBoard } from "./components/kanban-board"
import { RenvoiDetailSheet } from "./components/renvoi-detail-sheet"
import { CreateRenvoiDialog } from "./components/create-renvoi-dialog"

export default function RenvoisPage() {
  const supabase = useSupabase()
  const [renvois, setRenvois] = useState<Renvoi[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [reasonFilter, setReasonFilter] = useState<string>("all")

  // Dialog / Sheet
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRenvoi, setSelectedRenvoi] = useState<Renvoi | null>(null)

  // La Poste tracking
  const [trackingMap, setTrackingMap] = useState<Record<string, LaPosteTracking>>({})
  const [trackingLoading, setTrackingLoading] = useState(false)

  // ─── Load data ───────────────────────────────────────

  const loadRenvois = useCallback(async () => {
    const data = await getRenvois(supabase)
    setRenvois(data)
    return data
  }, [supabase])

  const fetchAllTracking = useCallback(async (renvoiList: Renvoi[]) => {
    const numbers = renvoiList
      .map((r) => r.trackingNumber)
      .filter((n) => n && n.length > 3)
      .filter((n, i, arr) => arr.indexOf(n) === i)

    if (numbers.length === 0) return

    setTrackingLoading(true)
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers }),
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
      // silent
    } finally {
      setTrackingLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRenvois()
      .then((data) => {
        if (data?.length) fetchAllTracking(data)
      })
      .finally(() => setLoading(false))
  }, [loadRenvois, fetchAllTracking])

  // ─── Filtering (search + reason, no status filter — columns are the filter) ─

  const filteredRenvois = useMemo(() => {
    return renvois.filter((r) => {
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          r.orderName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          r.trackingNumber.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [renvois, reasonFilter, searchQuery])

  // ─── Actions ─────────────────────────────────────────

  async function handleStatusChange(id: string, newStatus: RenvoiStatus) {
    // Optimistic update
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
    // Also update the selected renvoi if it's the one being changed
    setSelectedRenvoi((prev) => prev && prev.id === id ? { ...prev, status: newStatus } : prev)
    await updateRenvoiStatus(supabase, id, newStatus)
    toast.success(`Statut : ${getStatusOption(newStatus).label}`)
  }

  async function handleTrackingChange(id: string, tracking: string) {
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, trackingNumber: tracking } : r)))
    setSelectedRenvoi((prev) => prev && prev.id === id ? { ...prev, trackingNumber: tracking } : prev)
    await updateRenvoiTracking(supabase, id, tracking)
    toast.success("Numero de suivi enregistre")
    // Fetch La Poste tracking
    if (tracking && tracking.length > 3) {
      try {
        const res = await fetch(`/api/tracking?numbers=${encodeURIComponent(tracking)}`)
        if (res.ok) {
          const json = await res.json()
          if (json.tracking?.[0]) {
            setTrackingMap((prev) => ({ ...prev, [tracking]: json.tracking[0] }))
          }
        }
      } catch { /* silent */ }
    }
  }

  async function handleNoteChange(id: string, note: string) {
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, note } : r)))
    setSelectedRenvoi((prev) => prev && prev.id === id ? { ...prev, note } : prev)
    await updateRenvoiNote(supabase, id, note)
  }

  async function handleColisRevenuToggle(id: string, value: boolean) {
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, colisRevenu: value } : r)))
    setSelectedRenvoi((prev) => prev && prev.id === id ? { ...prev, colisRevenu: value } : prev)
    await updateRenvoiColisRevenu(supabase, id, value)
    toast.success(value ? "Colis marque comme revenu" : "Colis marque comme non revenu")
  }

  async function handleDelete(id: string) {
    setRenvois((prev) => prev.filter((r) => r.id !== id))
    setSelectedRenvoi(null)
    await deleteRenvoi(supabase, id)
    toast.success("Renvoi supprime")
  }

  // ─── Loading ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="flex-1 h-96 rounded-xl" />)}
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Renvois</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2 bg-[#007AFF] hover:bg-[#0066DD]">
          <Plus className="h-4 w-4" />
          Nouveau renvoi
        </Button>
      </div>

      {/* KPIs */}
      <KpiBar renvois={renvois} />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher commande, client, tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-[13px]"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
        >
          <option value="all">Toutes les raisons</option>
          {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        renvois={filteredRenvois}
        trackingMap={trackingMap}
        onCardClick={(renvoi) => {
          setSelectedRenvoi(renvoi)
          // Fetch fresh tracking for this card
          if (renvoi.trackingNumber && renvoi.trackingNumber.length > 3) {
            fetch(`/api/tracking?numbers=${encodeURIComponent(renvoi.trackingNumber)}`)
              .then((res) => res.ok ? res.json() : null)
              .then((json) => {
                if (json?.tracking?.[0]) {
                  setTrackingMap((prev) => ({ ...prev, [renvoi.trackingNumber]: json.tracking[0] }))
                }
              })
              .catch(() => {})
          }
        }}
        onStatusChange={handleStatusChange}
      />

      {/* Detail Sheet */}
      <RenvoiDetailSheet
        renvoi={selectedRenvoi}
        open={!!selectedRenvoi}
        onOpenChange={(open) => { if (!open) setSelectedRenvoi(null) }}
        tracking={selectedRenvoi?.trackingNumber ? trackingMap[selectedRenvoi.trackingNumber] : undefined}
        trackingLoading={trackingLoading && !!selectedRenvoi?.trackingNumber}
        onStatusChange={handleStatusChange}
        onTrackingChange={handleTrackingChange}
        onNoteChange={handleNoteChange}
        onColisRevenuToggle={handleColisRevenuToggle}
        onDelete={handleDelete}
      />

      {/* Create Dialog */}
      <CreateRenvoiDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={async () => {
          const data = await loadRenvois()
          if (data?.length) fetchAllTracking(data)
          setShowCreate(false)
          toast.success("Renvoi cree avec succes")
        }}
        supabase={supabase}
      />
    </div>
  )
}
