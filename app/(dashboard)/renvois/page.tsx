"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  RotateCcw,
  Plus,
  Search,
  Trash2,
  StickyNote,
  Package,
  Euro,
  CalendarDays,
  Clock,
  ChevronDown,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase/use-supabase"
import {
  getRenvois,
  createRenvoi,
  updateRenvoiStatus,
  updateRenvoiNote,
  deleteRenvoi,
  REASON_OPTIONS,
  STATUS_OPTIONS,
  getReasonLabel,
  getStatusOption,
} from "@/lib/renvois"
import type { Renvoi, RenvoiReason, RenvoiStatus } from "@/lib/types"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

// ─── Types locaux ────────────────────────────────────

interface SearchOrderResult {
  id: string
  name: string
  createdAt: string
  totalPrice: string
  fulfillmentStatus: string | null
  customerName: string
  customerEmail: string
}

// ─── Helpers ─────────────────────────────────────────

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

// ─── Composants internes ─────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "#007AFF",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Page principale ─────────────────────────────────

export default function RenvoisPage() {
  const supabase = useSupabase()
  const [renvois, setRenvois] = useState<Renvoi[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [reasonFilter, setReasonFilter] = useState<string>("all")

  // Dialog création
  const [showCreate, setShowCreate] = useState(false)

  // Dialog note
  const [editingNote, setEditingNote] = useState<{ id: string; note: string } | null>(null)

  // ─── Chargement des données ─────────────────────────

  const loadRenvois = useCallback(async () => {
    const data = await getRenvois(supabase)
    setRenvois(data)
  }, [supabase])

  useEffect(() => {
    loadRenvois().finally(() => setLoading(false))
  }, [loadRenvois])

  // ─── Stats ──────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = renvois.filter((r) => {
      const d = new Date(r.renvoiDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const totalCost = renvois.reduce((sum, r) => sum + parseFloat(r.orderTotal || "0"), 0)
    const enCours = renvois.filter((r) => r.status === "en_cours" || r.status === "expedie").length

    return {
      total: renvois.length,
      totalCost: totalCost.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
      thisMonth: thisMonth.length,
      enCours,
    }
  }, [renvois])

  // ─── Filtrage ───────────────────────────────────────

  const filteredRenvois = useMemo(() => {
    return renvois.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          r.orderName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          r.trackingNumber.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [renvois, statusFilter, reasonFilter, searchQuery])

  // ─── Charts data ────────────────────────────────────

  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
      months[key] = 0
    }
    for (const r of renvois) {
      const d = new Date(r.renvoiDate)
      const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
      if (key in months) months[key]++
    }
    return Object.entries(months).map(([month, count]) => ({ month, count }))
  }, [renvois])

  const reasonData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of renvois) {
      const label = getReasonLabel(r.reason)
      counts[label] = (counts[label] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  }, [renvois])

  const REASON_COLORS = ["#007AFF", "#E67C00", "#8B5CF6", "#047B5D", "#C70A24"]

  // ─── Actions ────────────────────────────────────────

  async function handleStatusChange(id: string, newStatus: RenvoiStatus) {
    await updateRenvoiStatus(supabase, id, newStatus)
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
    toast.success(`Statut mis à jour : ${getStatusOption(newStatus).label}`)
  }

  async function handleDelete(id: string) {
    await deleteRenvoi(supabase, id)
    setRenvois((prev) => prev.filter((r) => r.id !== id))
    toast.success("Renvoi supprimé")
  }

  async function handleSaveNote() {
    if (!editingNote) return
    await updateRenvoiNote(supabase, editingNote.id, editingNote.note)
    setRenvois((prev) =>
      prev.map((r) => (r.id === editingNote.id ? { ...r, note: editingNote.note } : r))
    )
    setEditingNote(null)
    toast.success("Note enregistrée")
  }

  // ─── Loading state ──────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  // ─── Rendu principal ────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Renvois</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Suivi des colis renvoyés
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="gap-2 bg-[#007AFF] hover:bg-[#0066DD]"
        >
          <Plus className="h-4 w-4" />
          Nouveau renvoi
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={RotateCcw}
          label="Total renvois"
          value={stats.total}
          color="#007AFF"
        />
        <KpiCard
          icon={Euro}
          label="Coût total"
          value={stats.totalCost}
          color="#C70A24"
        />
        <KpiCard
          icon={CalendarDays}
          label="Ce mois-ci"
          value={stats.thisMonth}
          color="#8B5CF6"
        />
        <KpiCard
          icon={Clock}
          label="En cours"
          value={stats.enCours}
          color="#E67C00"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* ─── Tab Liste ─── */}
        <TabsContent value="list" className="space-y-4">
          {/* Filtres */}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
            >
              <option value="all">Tous les statuts</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
            >
              <option value="all">Toutes les raisons</option>
              {REASON_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {filteredRenvois.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-muted-foreground">
              {renvois.length === 0
                ? "Aucun renvoi enregistré. Clique sur \"Nouveau renvoi\" pour commencer."
                : "Aucun renvoi trouvé pour ces filtres."}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[12px]">Date</TableHead>
                    <TableHead className="text-[12px]">Commande</TableHead>
                    <TableHead className="text-[12px]">Client</TableHead>
                    <TableHead className="text-[12px]">Valeur</TableHead>
                    <TableHead className="text-[12px]">Raison</TableHead>
                    <TableHead className="text-[12px]">Statut</TableHead>
                    <TableHead className="text-[12px]">Suivi</TableHead>
                    <TableHead className="text-[12px] w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRenvois.map((r) => {
                    const statusOpt = getStatusOption(r.status)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-[13px]">
                          {formatDate(r.renvoiDate)}
                        </TableCell>
                        <TableCell className="text-[13px] font-medium">
                          {r.orderName}
                        </TableCell>
                        <TableCell>
                          <p className="text-[13px]">{r.customerName}</p>
                          {r.customerEmail && (
                            <p className="text-[11px] text-muted-foreground">
                              {r.customerEmail}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-[13px]">
                          {formatCurrency(r.orderTotal)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {getReasonLabel(r.reason)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
                                  statusOpt.bg,
                                  statusOpt.text
                                )}
                              >
                                {statusOpt.label}
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {STATUS_OPTIONS.map((s) => (
                                <DropdownMenuItem
                                  key={s.value}
                                  onClick={() => handleStatusChange(r.id, s.value)}
                                  className="text-[13px]"
                                >
                                  <span
                                    className={cn(
                                      "w-2 h-2 rounded-full mr-2",
                                      s.bg.replace("/15", "")
                                    )}
                                  />
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {r.trackingNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setEditingNote({ id: r.id, note: r.note })
                              }
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                              title="Note"
                            >
                              <StickyNote className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Supprimer ce renvoi ?")) {
                                  handleDelete(r.id)
                                }
                              }}
                              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ─── Tab Stats ─── */}
        <TabsContent value="stats" className="space-y-6">
          {renvois.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-muted-foreground">
              Aucune donnée à afficher.
            </div>
          ) : (
            <>
              {/* Renvois par mois */}
              <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                <h2 className="text-[13px] font-semibold mb-4">
                  Renvois par mois (6 derniers mois)
                </h2>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Bar dataKey="count" name="Renvois" fill="#007AFF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Renvois par raison */}
              <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                <h2 className="text-[13px] font-semibold mb-4">
                  Renvois par raison
                </h2>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={reasonData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="reason"
                        tick={{ fontSize: 11 }}
                        width={120}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Bar dataKey="count" name="Renvois" radius={[0, 4, 4, 0]}>
                        {reasonData.map((_, i) => (
                          <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog : Nouveau renvoi ─── */}
      <CreateRenvoiDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={async () => {
          await loadRenvois()
          setShowCreate(false)
          toast.success("Renvoi créé avec succès")
        }}
        supabase={supabase}
      />

      {/* ─── Dialog : Éditer note ─── */}
      <Dialog
        open={!!editingNote}
        onOpenChange={(open) => !open && setEditingNote(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingNote?.note ?? ""}
            onChange={(e) =>
              setEditingNote((prev) =>
                prev ? { ...prev, note: e.target.value } : null
              )
            }
            placeholder="Ajouter une note..."
            className="text-[13px] min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingNote(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNote}
              className="bg-[#007AFF] hover:bg-[#0066DD]"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Dialog : Créer un renvoi ────────────────────────

function CreateRenvoiDialog({
  open,
  onOpenChange,
  onCreated,
  supabase,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  supabase: ReturnType<typeof useSupabase>
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchOrderResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SearchOrderResult | null>(null)

  // Step 2 fields
  const [reason, setReason] = useState<RenvoiReason>("colis_perdu")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1)
      setSearchQuery("")
      setSearchResults([])
      setSelectedOrder(null)
      setReason("colis_perdu")
      setTrackingNumber("")
      setNote("")
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/shopify/search-orders?q=${encodeURIComponent(searchQuery)}`
        )
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.orders ?? [])
        }
      } catch {
        // silent
      } finally {
        setSearching(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  function selectOrder(order: SearchOrderResult) {
    setSelectedOrder(order)
    setStep(2)
  }

  async function handleSubmit() {
    if (!selectedOrder) return
    setSubmitting(true)
    try {
      await createRenvoi(supabase, {
        shopifyOrderId: selectedOrder.id,
        orderName: selectedOrder.name,
        orderTotal: selectedOrder.totalPrice,
        customerName: selectedOrder.customerName,
        customerEmail: selectedOrder.customerEmail,
        reason,
        trackingNumber,
        note,
      })
      onCreated()
    } catch (err) {
      toast.error("Erreur lors de la création du renvoi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Rechercher une commande" : "Détails du renvoi"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="N° commande, nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-[13px]"
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {searching && (
                <div className="text-center py-6 text-[13px] text-muted-foreground">
                  Recherche en cours...
                </div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-6 text-[13px] text-muted-foreground">
                  Aucune commande trouvée.
                </div>
              )}
              {searchResults.map((order) => (
                <button
                  key={order.id}
                  onClick={() => selectOrder(order)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium">{order.name}</span>
                      <span className="text-[12px] text-muted-foreground ml-2">
                        {order.customerName}
                      </span>
                    </div>
                    <span className="text-[13px] font-medium">
                      {formatCurrency(order.totalPrice)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </span>
                    {order.fulfillmentStatus && (
                      <Badge variant="secondary" className="text-[10px]">
                        {order.fulfillmentStatus}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedOrder && (
          <div className="space-y-4">
            {/* Résumé commande */}
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">{selectedOrder.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {selectedOrder.customerName} — {selectedOrder.customerEmail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium">
                    {formatCurrency(selectedOrder.totalPrice)}
                  </p>
                  <button
                    onClick={() => setStep(1)}
                    className="text-[11px] text-[#007AFF] hover:underline"
                  >
                    Changer
                  </button>
                </div>
              </div>
            </div>

            {/* Raison */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                Raison du renvoi
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as RenvoiReason)}
                className="w-full h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Numéro de suivi */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                Numéro de suivi (optionnel)
              </label>
              <Input
                placeholder="Ex: 6A12345678901"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="text-[13px]"
              />
            </div>

            {/* Note */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                Note (optionnel)
              </label>
              <Textarea
                placeholder="Contexte, détails..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-[13px] min-h-[60px]"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-1.5 bg-[#007AFF] hover:bg-[#0066DD]"
              >
                <Package className="h-3.5 w-3.5" />
                {submitting ? "Création..." : "Créer le renvoi"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
