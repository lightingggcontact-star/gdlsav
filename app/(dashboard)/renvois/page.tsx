"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  RotateCcw,
  Plus,
  Search,
  Trash2,
  Package,
  Euro,
  CalendarDays,
  Clock,
  ChevronDown,
  Truck,
  PackageCheck,
  Check,
  ExternalLink,
  Save,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  updateRenvoiTracking,
  updateRenvoiNote,
  updateRenvoiColisRevenu,
  deleteRenvoi,
  REASON_OPTIONS,
  STATUS_OPTIONS,
  getReasonLabel,
  getReasonEmoji,
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

// ─── KPI Card ────────────────────────────────────────

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
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Renvoi Card ─────────────────────────────────────

function RenvoiCard({
  renvoi,
  onStatusChange,
  onTrackingChange,
  onNoteChange,
  onColisRevenuToggle,
  onDelete,
}: {
  renvoi: Renvoi
  onStatusChange: (id: string, status: RenvoiStatus) => void
  onTrackingChange: (id: string, tracking: string) => void
  onNoteChange: (id: string, note: string) => void
  onColisRevenuToggle: (id: string, value: boolean) => void
  onDelete: (id: string) => void
}) {
  const statusOpt = getStatusOption(renvoi.status)
  const [editingTracking, setEditingTracking] = useState(false)
  const [trackingInput, setTrackingInput] = useState(renvoi.trackingNumber)
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState(renvoi.note)

  function saveTracking() {
    onTrackingChange(renvoi.id, trackingInput)
    setEditingTracking(false)
  }

  function saveNote() {
    onNoteChange(renvoi.id, noteInput)
    setEditingNote(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,.05)] overflow-hidden">
      {/* ─── Header : commande initiale ─── */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#007AFF]/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-[#007AFF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">{renvoi.orderName}</span>
                <span className="text-[13px] font-medium text-[#007AFF]">
                  {formatCurrency(renvoi.orderTotal)}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {renvoi.customerName}
                {renvoi.customerEmail && ` — ${renvoi.customerEmail}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {formatDate(renvoi.renvoiDate)}
            </span>
            <button
              onClick={() => { if (confirm("Supprimer ce renvoi ?")) onDelete(renvoi.id) }}
              className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="px-4 py-3 space-y-3">
        {/* Raison + Statut */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">{getReasonEmoji(renvoi.reason)}</span>
            <Badge variant="secondary" className="text-[11px]">
              {getReasonLabel(renvoi.reason)}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                statusOpt.bg, statusOpt.text
              )}>
                {renvoi.status === "livre" && <Check className="h-3 w-3" />}
                {renvoi.status === "expedie" && <Truck className="h-3 w-3" />}
                {renvoi.status === "en_cours" && <Clock className="h-3 w-3" />}
                {statusOpt.label}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onClick={() => onStatusChange(renvoi.id, s.value)}
                  className="text-[13px] gap-2"
                >
                  <span className={cn("w-2 h-2 rounded-full", s.value === "en_cours" ? "bg-amber-500" : s.value === "expedie" ? "bg-blue-500" : s.value === "livre" ? "bg-emerald-500" : "bg-red-500")} />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tracking du renvoi */}
        <div className="rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
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
                placeholder="Numéro de suivi..."
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
            <p className={cn("text-[13px]", renvoi.trackingNumber ? "font-mono" : "text-muted-foreground italic")}>
              {renvoi.trackingNumber || "Pas encore de numéro de suivi"}
            </p>
          )}
        </div>

        {/* Colis revenu */}
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

        {/* Note */}
        {(renvoi.note || editingNote) && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[12px] font-medium text-muted-foreground">Note</span>
              </div>
              {!editingNote && (
                <button
                  onClick={() => { setNoteInput(renvoi.note); setEditingNote(true) }}
                  className="text-[11px] text-[#007AFF] hover:underline"
                >
                  Modifier
                </button>
              )}
            </div>
            {editingNote ? (
              <div className="space-y-2">
                <Textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="text-[13px] min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNote} className="h-7 text-[12px] bg-[#007AFF] hover:bg-[#0066DD]">
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNote(false)} className="h-7 text-[12px]">
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-foreground/80 whitespace-pre-wrap">{renvoi.note}</p>
            )}
          </div>
        )}

        {/* Bouton ajouter note si pas de note */}
        {!renvoi.note && !editingNote && (
          <button
            onClick={() => { setNoteInput(""); setEditingNote(true) }}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ajouter une note
          </button>
        )}
      </div>
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

  // ─── Chargement ─────────────────────────────────────

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
        return (
          r.orderName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          r.trackingNumber.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [renvois, statusFilter, reasonFilter, searchQuery])

  // ─── Charts ─────────────────────────────────────────

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
    toast.success(`Statut : ${getStatusOption(newStatus).label}`)
  }

  async function handleTrackingChange(id: string, tracking: string) {
    await updateRenvoiTracking(supabase, id, tracking)
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, trackingNumber: tracking } : r)))
    toast.success("Numéro de suivi enregistré")
  }

  async function handleNoteChange(id: string, note: string) {
    await updateRenvoiNote(supabase, id, note)
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, note } : r)))
    toast.success("Note enregistrée")
  }

  async function handleColisRevenuToggle(id: string, value: boolean) {
    await updateRenvoiColisRevenu(supabase, id, value)
    setRenvois((prev) => prev.map((r) => (r.id === id ? { ...r, colisRevenu: value } : r)))
    toast.success(value ? "Colis marqué comme revenu" : "Colis marqué comme non revenu")
  }

  async function handleDelete(id: string) {
    await deleteRenvoi(supabase, id)
    setRenvois((prev) => prev.filter((r) => r.id !== id))
    toast.success("Renvoi supprimé")
  }

  // ─── Loading ────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    )
  }

  // ─── Rendu ──────────────────────────────────────────

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
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2 bg-[#007AFF] hover:bg-[#0066DD]">
          <Plus className="h-4 w-4" />
          Nouveau renvoi
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={RotateCcw} label="Total renvois" value={stats.total} color="#007AFF" />
        <KpiCard icon={Euro} label="Coût total" value={stats.totalCost} color="#C70A24" />
        <KpiCard icon={CalendarDays} label="Ce mois-ci" value={stats.thisMonth} color="#8B5CF6" />
        <KpiCard icon={Clock} label="En cours" value={stats.enCours} color="#E67C00" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Renvois</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* ─── Tab Renvois (cards) ─── */}
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
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
            >
              <option value="all">Toutes les raisons</option>
              {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Cards */}
          {filteredRenvois.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-muted-foreground">
              {renvois.length === 0
                ? "Aucun renvoi enregistré. Clique sur \"Nouveau renvoi\" pour commencer."
                : "Aucun renvoi trouvé pour ces filtres."}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRenvois.map((r) => (
                <RenvoiCard
                  key={r.id}
                  renvoi={r}
                  onStatusChange={handleStatusChange}
                  onTrackingChange={handleTrackingChange}
                  onNoteChange={handleNoteChange}
                  onColisRevenuToggle={handleColisRevenuToggle}
                  onDelete={handleDelete}
                />
              ))}
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
              <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                <h2 className="text-[13px] font-semibold mb-4">Renvois par mois (6 derniers mois)</h2>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                      <Bar dataKey="count" name="Renvois" fill="#007AFF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                <h2 className="text-[13px] font-semibold mb-4">Renvois par raison</h2>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reasonData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={120} />
                      <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
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
  const [reason, setReason] = useState<RenvoiReason>("colis_perdu")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (searchQuery.trim().length < 2) { setSearchResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/shopify/search-orders?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.orders ?? [])
        }
      } catch { /* silent */ } finally { setSearching(false) }
    }, 500)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

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
    } catch { toast.error("Erreur lors de la création") } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Rechercher une commande" : "Détails du renvoi"}</DialogTitle>
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
              {searching && <div className="text-center py-6 text-[13px] text-muted-foreground">Recherche en cours...</div>}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-6 text-[13px] text-muted-foreground">Aucune commande trouvée.</div>
              )}
              {searchResults.map((order) => (
                <button
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); setStep(2) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium">{order.name}</span>
                      <span className="text-[12px] text-muted-foreground ml-2">{order.customerName}</span>
                    </div>
                    <span className="text-[13px] font-medium">{formatCurrency(order.totalPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</span>
                    {order.fulfillmentStatus && <Badge variant="secondary" className="text-[10px]">{order.fulfillmentStatus}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedOrder && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">{selectedOrder.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {selectedOrder.customerName} — {selectedOrder.customerEmail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium">{formatCurrency(selectedOrder.totalPrice)}</p>
                  <button onClick={() => setStep(1)} className="text-[11px] text-[#007AFF] hover:underline">Changer</button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Raison du renvoi</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as RenvoiReason)}
                className="w-full h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
              >
                {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Numéro de suivi du renvoi (optionnel)</label>
              <Input placeholder="Ex: 6A12345678901" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="text-[13px]" />
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Note (optionnel)</label>
              <Textarea placeholder="Contexte, détails..." value={note} onChange={(e) => setNote(e.target.value)} className="text-[13px] min-h-[60px]" />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5 bg-[#007AFF] hover:bg-[#0066DD]">
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
