"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Lock,
  ShoppingBag,
  Truck,
  Clock,
  Save,
  Database,
  Upload,
} from "lucide-react"
import { FileText } from "lucide-react"
import { useSupabase } from "@/lib/supabase/use-supabase"

// Old localStorage keys to migrate
const MIGRATION_KEYS = {
  segments: "gdl-segments",
  orderNotes: "gdl-order-notes",
  formCategories: "gdl-form-categories",
  pinnedForms: "gdl-pinned-forms",
  reviewStatuses: "gdl-review-statuses",
  ticketLabels: "gdl-ticket-labels",
} as const

export default function SettingsPage() {
  const supabase = useSupabase()
  const [health, setHealth] = useState<Record<string, boolean> | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [migrationDone, setMigrationDone] = useState(false)

  const [thresholdFR, setThresholdFR] = useState("3")
  const [thresholdBE, setThresholdBE] = useState("5")

  // Check if there's data to migrate
  const [hasLocalData, setHasLocalData] = useState(false)
  useEffect(() => {
    const hasData = Object.values(MIGRATION_KEYS).some((key) => {
      const val = localStorage.getItem(key)
      return val && val !== "[]" && val !== "{}" && val !== "null"
    })
    setHasLocalData(hasData)
  }, [])

  useEffect(() => {
    async function loadThresholds() {
      const { data } = await supabase.from("settings").select("threshold_fr, threshold_be").single()
      if (data) {
        setThresholdFR(String(data.threshold_fr))
        setThresholdBE(String(data.threshold_be))
      }
    }
    loadThresholds()
  }, [supabase])

  useEffect(() => {
    fetchHealth()
  }, [])

  async function fetchHealth() {
    setHealthLoading(true)
    try {
      const res = await fetch("/api/health")
      if (res.ok) {
        const data = await res.json()
        setHealth(data)
      }
    } catch {
      // Ignore
    } finally {
      setHealthLoading(false)
    }
  }

  async function saveThresholds() {
    const fr = parseInt(thresholdFR)
    const be = parseInt(thresholdBE)

    if (isNaN(fr) || fr < 1 || isNaN(be) || be < 1) {
      toast.error("Les seuils doivent être des nombres positifs")
      return
    }

    const { data } = await supabase.from("settings").select("id").single()
    if (data) {
      await supabase.from("settings").update({ threshold_fr: fr, threshold_be: be, updated_at: new Date().toISOString() }).eq("id", data.id)
    }
    toast.success("Seuils sauvegardés")
  }

  async function migrateLocalStorage() {
    setMigrating(true)
    const results: string[] = []

    try {
      // 1. Migrate segments
      const segRaw = localStorage.getItem(MIGRATION_KEYS.segments)
      if (segRaw) {
        try {
          const segments = JSON.parse(segRaw) as Array<{
            id: string; name: string; color: string
            orderIds?: string[]; notes?: Record<string, string>
          }>
          for (const seg of segments) {
            const { data: created } = await supabase
              .from("segments")
              .insert({ name: seg.name, color: seg.color })
              .select("id")
              .single()

            if (created && seg.orderIds?.length) {
              await supabase.from("segment_orders").insert(
                seg.orderIds.map((oid) => ({ segment_id: created.id, order_id: oid }))
              )
              if (seg.notes) {
                const noteEntries = Object.entries(seg.notes).filter(([, v]) => v)
                if (noteEntries.length) {
                  await supabase.from("segment_order_notes").insert(
                    noteEntries.map(([oid, note]) => ({
                      segment_id: created.id, order_id: oid, note,
                    }))
                  )
                }
              }
            }
          }
          results.push(`${segments.length} segment(s)`)
        } catch { /* skip */ }
      }

      // 2. Migrate order notes
      const notesRaw = localStorage.getItem(MIGRATION_KEYS.orderNotes)
      if (notesRaw) {
        try {
          const notes = JSON.parse(notesRaw) as Record<string, string>
          const entries = Object.entries(notes).filter(([, v]) => v)
          if (entries.length) {
            await supabase.from("order_notes").upsert(
              entries.map(([oid, note]) => ({ order_id: oid, note })),
              { onConflict: "order_id" }
            )
            results.push(`${entries.length} note(s) commande`)
          }
        } catch { /* skip */ }
      }

      // 3. Migrate form categories
      const catRaw = localStorage.getItem(MIGRATION_KEYS.formCategories)
      if (catRaw) {
        try {
          const categories = JSON.parse(catRaw) as Array<{
            id: string; name: string; color: string; formIds?: string[]
          }>
          for (const cat of categories) {
            const { data: created } = await supabase
              .from("form_categories")
              .insert({ name: cat.name, color: cat.color })
              .select("id")
              .single()

            if (created && cat.formIds?.length) {
              await supabase.from("form_category_assignments").upsert(
                cat.formIds.map((fid) => ({ form_id: fid, category_id: created.id })),
                { onConflict: "form_id" }
              )
            }
          }
          results.push(`${categories.length} catégorie(s)`)
        } catch { /* skip */ }
      }

      // 4. Migrate pinned forms
      const pinsRaw = localStorage.getItem(MIGRATION_KEYS.pinnedForms)
      if (pinsRaw) {
        try {
          const pins = JSON.parse(pinsRaw) as string[]
          if (pins.length) {
            await supabase.from("pinned_forms").upsert(
              pins.map((fid) => ({ form_id: fid, pinned_at: new Date().toISOString() })),
              { onConflict: "form_id" }
            )
            results.push(`${pins.length} formulaire(s) épinglé(s)`)
          }
        } catch { /* skip */ }
      }

      // 5. Migrate review statuses
      const reviewRaw = localStorage.getItem(MIGRATION_KEYS.reviewStatuses)
      if (reviewRaw) {
        try {
          const statuses = JSON.parse(reviewRaw) as Record<string, {
            status: string; updatedAt?: string; note?: string
          }>
          const entries = Object.entries(statuses)
          if (entries.length) {
            await supabase.from("review_statuses").upsert(
              entries.map(([sid, s]) => ({
                submission_id: sid,
                status: s.status,
                note: s.note ?? null,
                updated_at: s.updatedAt ?? new Date().toISOString(),
              })),
              { onConflict: "submission_id" }
            )
            results.push(`${entries.length} statut(s) avis`)
          }
        } catch { /* skip */ }
      }

      // 6. Migrate ticket labels
      const labelsRaw = localStorage.getItem(MIGRATION_KEYS.ticketLabels)
      if (labelsRaw) {
        try {
          const labels = JSON.parse(labelsRaw) as Record<string, string>
          const entries = Object.entries(labels).filter(([, v]) => v)
          if (entries.length) {
            await supabase.from("ticket_labels").upsert(
              entries.map(([tid, label]) => ({ ticket_id: tid, label })),
              { onConflict: "ticket_id" }
            )
            results.push(`${entries.length} label(s) ticket`)
          }
        } catch { /* skip */ }
      }

      // Clear migrated keys
      Object.values(MIGRATION_KEYS).forEach((key) => localStorage.removeItem(key))

      if (results.length > 0) {
        toast.success(`Migration réussie : ${results.join(", ")}`)
      } else {
        toast.info("Aucune donnée à migrer")
      }
      setMigrationDone(true)
      setHasLocalData(false)
    } catch (err) {
      toast.error("Erreur lors de la migration")
      console.error("Migration error:", err)
    } finally {
      setMigrating(false)
    }
  }

  function ConnectionBadge({ connected }: { connected: boolean | undefined }) {
    if (connected === undefined) {
      return <Badge variant="secondary" className="text-xs">Vérification...</Badge>
    }
    return connected ? (
      <Badge className="bg-[#CDFED4] text-[#047B5D] border-transparent text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        Connecté
      </Badge>
    ) : (
      <Badge className="bg-[#FEE8EB] text-[#C70A24] border-transparent text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        Non connecté
      </Badge>
    )
  }

  const connections = [
    {
      name: "Shopify",
      description: "Admin API GraphQL",
      icon: ShoppingBag,
      iconColor: "text-[#047B5D]",
      iconBg: "bg-[#CDFED4]",
      connected: health?.shopify,
    },
    {
      name: "Fillout",
      description: "Formulaires & données",
      icon: FileText,
      iconColor: "text-[#007AFF]",
      iconBg: "bg-[#EAF3FF]",
      connected: health?.fillout,
    },
    {
      name: "La Poste Suivi v2",
      description: "Tracking Colissimo / Chronopost",
      icon: Truck,
      iconColor: "text-[#E67C00]",
      iconBg: "bg-[#FFF1E3]",
      connected: health?.laPoste,
    },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Paramètres</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Configuration des intégrations et seuils d&apos;alerte
        </p>
      </div>

      {/* API Connections */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[13px] font-semibold">Connexions API</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHealth}
            disabled={healthLoading}
            className="gap-2 text-xs h-8"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", healthLoading && "animate-spin")} />
            Tester
          </Button>
        </div>
        <div className="divide-y divide-border">
          {connections.map((conn) => (
            <div key={conn.name} className="flex items-center gap-4 px-5 py-4">
              <div className={cn("rounded-md p-2", conn.iconBg)}>
                <conn.icon className={cn("h-4 w-4", conn.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{conn.name}</p>
                <p className="text-xs text-muted-foreground">{conn.description}</p>
              </div>
              <ConnectionBadge connected={conn.connected} />
            </div>
          ))}
        </div>
      </div>

      {/* Delay Thresholds */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold">Seuils de retard</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Nombre de jours ouvrés après expédition au-delà duquel une commande
            est considérée en retard.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-background p-4">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                France (jours)
              </label>
              <Input
                type="number"
                min={1}
                max={30}
                value={thresholdFR}
                onChange={(e) => setThresholdFR(e.target.value)}
                className="bg-card border-border h-9"
              />
            </div>
            <div className="rounded-md bg-background p-4">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Belgique (jours)
              </label>
              <Input
                type="number"
                min={1}
                max={30}
                value={thresholdBE}
                onChange={(e) => setThresholdBE(e.target.value)}
                className="bg-card border-border h-9"
              />
            </div>
          </div>
          <Button
            onClick={saveThresholds}
            className="bg-gdl-purple text-white hover:bg-gdl-purple/90 gap-2"
          >
            <Save className="h-4 w-4" />
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* localStorage Migration */}
      {hasLocalData && !migrationDone && (
        <div className="rounded-lg border border-[#E67C00]/30 bg-[#FFF1E3] overflow-hidden shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E67C00]/20">
            <Database className="h-4 w-4 text-[#E67C00]" />
            <h2 className="text-[13px] font-semibold text-[#8A6116]">Migration des données</h2>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-[#8A6116]">
              Des données locales (segments, catégories, statuts...) ont été détectées dans
              votre navigateur. Migrez-les vers Supabase pour les partager avec l&apos;équipe.
            </p>
            <Button
              onClick={migrateLocalStorage}
              disabled={migrating}
              className="bg-[#E67C00] text-white hover:bg-[#E67C00]/90 gap-2"
            >
              {migrating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {migrating ? "Migration en cours..." : "Migrer vers Supabase"}
            </Button>
          </div>
        </div>
      )}

      {/* Future integrations */}
      <div className="rounded-lg border border-border bg-card overflow-hidden opacity-50">
        <div className="flex items-center gap-3 px-5 py-4">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Gorgias</p>
              <Badge variant="secondary" className="text-[10px]">Bientôt</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envoi automatique d&apos;emails de suivi aux clients en retard
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden opacity-50">
        <div className="flex items-center gap-3 px-5 py-4">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Sendcloud</p>
              <Badge variant="secondary" className="text-[10px]">Bientôt</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestion avancée des expéditions et retours
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
