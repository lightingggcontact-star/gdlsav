"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Lightbulb,
  ShieldAlert,
  MessageSquare,
  Sparkles,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Quote,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { toast } from "sonner"
import type {
  InsightsPeriod,
  InsightsData,
  InsightsCacheRow,
  PainPoint,
  Objection,
  ExtremeReview,
} from "@/lib/types"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

// ─── Period helpers ─────────────────────────────────

const PERIOD_OPTIONS: { value: InsightsPeriod; label: string }[] = [
  { value: "this_week", label: "Cette semaine" },
  { value: "last_week", label: "Sem. dernière" },
  { value: "this_month", label: "Ce mois" },
  { value: "last_3_months", label: "3 derniers mois" },
]

function getPeriodDates(period: InsightsPeriod): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  switch (period) {
    case "this_week": {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      const from = new Date(now)
      from.setDate(now.getDate() - diff)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    }
    case "last_week": {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - diff)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      lastMonday.setHours(0, 0, 0, 0)
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(thisMonday.getDate() - 1)
      lastSunday.setHours(23, 59, 59)
      return { from: lastMonday, to: lastSunday }
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from, to }
    }
    case "last_3_months": {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { from, to }
    }
  }
}

function getPeriodKey(period: InsightsPeriod): string {
  const now = new Date()
  switch (period) {
    case "this_week": {
      const jan1 = new Date(now.getFullYear(), 0, 1)
      const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000)
      const week = Math.ceil((days + jan1.getDay() + 1) / 7)
      return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`
    }
    case "last_week": {
      const lastWeek = new Date(now.getTime() - 7 * 86400000)
      const jan1 = new Date(lastWeek.getFullYear(), 0, 1)
      const days = Math.floor((lastWeek.getTime() - jan1.getTime()) / 86400000)
      const week = Math.ceil((days + jan1.getDay() + 1) / 7)
      return `${lastWeek.getFullYear()}-W${String(week).padStart(2, "0")}`
    }
    case "this_month":
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    case "last_3_months": {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    }
  }
}

function getPeriodLabel(period: InsightsPeriod): string {
  return PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period
}

// ─── Severity config ────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  high: "#C70A24",
  medium: "#E67C00",
  low: "#007AFF",
}

const SEVERITY_LABELS: Record<string, string> = {
  high: "Critique",
  medium: "Moyen",
  low: "Faible",
}

// ─── KPI Card ───────────────────────────────────────

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

// ─── Pain Point Card ────────────────────────────────

function PainPointCard({ point }: { point: PainPoint }) {
  const sevColor = SEVERITY_COLORS[point.severity] ?? "#007AFF"

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-[13px] font-semibold">{point.label}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-[10px]" style={{ borderColor: `${sevColor}40`, color: sevColor, backgroundColor: `${sevColor}10` }}>
            {SEVERITY_LABELS[point.severity] ?? point.severity}
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border">
            {point.frequency}x
          </Badge>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">{point.description}</p>
      {point.example_quote && (
        <div className="rounded-md bg-[#F5F5F5] dark:bg-secondary p-3 mb-3 border-l-2" style={{ borderColor: sevColor }}>
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            &ldquo;{point.example_quote}&rdquo;
          </p>
          {point.example_ticket_id && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">Ticket #{point.example_ticket_id}</p>
          )}
        </div>
      )}
      <div className="flex items-start gap-2">
        <Lightbulb className="h-3 w-3 text-[#007AFF] mt-0.5 shrink-0" />
        <p className="text-[11px] text-[#007AFF]">{point.suggested_action}</p>
      </div>
    </div>
  )
}

// ─── Objection Card ─────────────────────────────────

function ObjectionCard({ objection }: { objection: Objection }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-[13px] font-semibold">{objection.label}</h3>
        <Badge variant="outline" className="text-[10px] border-border shrink-0">
          {objection.frequency}x
        </Badge>
      </div>
      <p className="text-[12px] text-muted-foreground mb-2">{objection.description}</p>
      <p className="text-[11px] text-muted-foreground/80 mb-3">
        <span className="font-medium text-foreground">Contexte :</span> {objection.context}
      </p>
      {objection.example_quote && (
        <div className="rounded-md bg-[#F5F5F5] dark:bg-secondary p-3 mb-3 border-l-2 border-[#E67C00]">
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            &ldquo;{objection.example_quote}&rdquo;
          </p>
        </div>
      )}
      <div className="flex items-start gap-2">
        <MessageSquare className="h-3 w-3 text-[#047B5D] mt-0.5 shrink-0" />
        <p className="text-[11px] text-[#047B5D]">{objection.recommended_response}</p>
      </div>
    </div>
  )
}

// ─── Extreme Review Card ────────────────────────────

function ExtremeReviewCard({ review, type }: { review: ExtremeReview; type: "positive" | "negative" }) {
  const color = type === "positive" ? "#047B5D" : "#C70A24"
  const bgColor = type === "positive" ? "#CDFED4" : "#FEE8EB"
  const Icon = type === "positive" ? ThumbsUp : ThumbsDown

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: bgColor }}>
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
        <span className="text-[12px] font-medium">{review.customer_name}</span>
        <Badge variant="outline" className="text-[10px] border-border ml-auto">{review.topic}</Badge>
      </div>
      <div className="rounded-md bg-[#F5F5F5] dark:bg-secondary p-3 mb-2 border-l-2" style={{ borderColor: color }}>
        <p className="text-[12px] text-foreground italic leading-relaxed">
          &ldquo;{review.quote}&rdquo;
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Ticket #{review.ticket_id} {review.date && `- ${new Date(review.date).toLocaleDateString("fr-FR")}`}
        </span>
        <span className="text-[10px] font-medium" style={{ color }}>
          {review.sentiment_score}/10
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────

export default function InsightsPage() {
  const supabase = useSupabase()
  const [period, setPeriod] = useState<InsightsPeriod>("this_month")
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [meta, setMeta] = useState<{ ticketsAnalyzed: number; generatedAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [sending, setSending] = useState(false)

  const periodKey = useMemo(() => getPeriodKey(period), [period])

  // Load cached insights for current period
  const loadCache = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("insights_cache")
        .select("*")
        .eq("period_key", periodKey)
        .single()

      if (!error && data) {
        const row = data as InsightsCacheRow
        setInsights({
          pain_points: row.pain_points,
          objections: row.objections,
          extreme_reviews: row.extreme_reviews,
        })
        setMeta({ ticketsAnalyzed: row.tickets_analyzed, generatedAt: row.generated_at })
      } else {
        setInsights(null)
        setMeta(null)
      }
    } catch {
      setInsights(null)
      setMeta(null)
    }
    setLoading(false)
  }, [supabase, periodKey])

  useEffect(() => {
    loadCache()
  }, [loadCache])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const { from, to } = getPeriodDates(period)

      // Fetch tickets from ticket_cache
      const { data: tickets, error } = await supabase
        .from("ticket_cache")
        .select("*")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(100)

      if (error || !tickets || tickets.length === 0) {
        toast.error(
          tickets?.length === 0
            ? "Aucun ticket sur cette période. Synchronisez les tickets depuis le Dashboard."
            : "Erreur de lecture des tickets."
        )
        setGenerating(false)
        return
      }

      // Transform for API
      const ticketsForApi = tickets.map((t: any) => ({
        ticket_id: t.ticket_id,
        subject: t.subject,
        status: t.status,
        customer_name: t.customer_name,
        created_at: t.created_at,
        tags: t.tags || [],
        first_message: t.first_message || "",
        last_message: t.last_message || "",
        message_count: t.message_count || 0,
      }))

      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickets: ticketsForApi,
          periodKey,
          periodLabel: getPeriodLabel(period),
          periodFrom: from.toISOString(),
          periodTo: to.toISOString(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur d'analyse")
        setGenerating(false)
        return
      }

      const data = await res.json()
      setInsights({
        pain_points: data.pain_points,
        objections: data.objections,
        extreme_reviews: data.extreme_reviews,
      })
      setMeta({
        ticketsAnalyzed: data.tickets_analyzed,
        generatedAt: new Date().toISOString(),
      })
      toast.success(`Analyse terminée — ${data.tickets_analyzed} tickets`)
    } catch {
      toast.error("Erreur de connexion")
    }
    setGenerating(false)
  }

  // ─── Send by email ───

  function buildEmailHtml(data: InsightsData, periodLabel: string, ticketsCount: number): string {
    const sevEmoji: Record<string, string> = { high: "🔴", medium: "🟠", low: "🔵" }

    let html = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a">`
    html += `<h1 style="font-size:20px;margin-bottom:4px">Rapport Insights SAV — ${periodLabel}</h1>`
    html += `<p style="font-size:13px;color:#666;margin-top:0">${ticketsCount} tickets analysés — ${new Date().toLocaleDateString("fr-FR")}</p>`
    html += `<hr style="border:none;border-top:1px solid #e3e3e3;margin:16px 0">`

    // Pain points
    if (data.pain_points.length > 0) {
      html += `<h2 style="font-size:16px;margin-bottom:8px">Pain Points (${data.pain_points.length})</h2>`
      for (const p of data.pain_points) {
        html += `<div style="border:1px solid #e3e3e3;border-radius:8px;padding:12px;margin-bottom:8px">`
        html += `<p style="margin:0 0 4px"><strong>${sevEmoji[p.severity] || ""} ${p.label}</strong> <span style="color:#666;font-size:12px">(${p.frequency}x)</span></p>`
        html += `<p style="margin:0 0 6px;font-size:13px;color:#444">${p.description}</p>`
        if (p.example_quote) {
          html += `<p style="margin:0 0 6px;font-size:12px;color:#666;font-style:italic;border-left:3px solid #e3e3e3;padding-left:8px">"${p.example_quote}"</p>`
        }
        html += `<p style="margin:0;font-size:12px;color:#007AFF">💡 ${p.suggested_action}</p>`
        html += `</div>`
      }
    }

    // Objections
    if (data.objections.length > 0) {
      html += `<h2 style="font-size:16px;margin:20px 0 8px">Objections (${data.objections.length})</h2>`
      for (const o of data.objections) {
        html += `<div style="border:1px solid #e3e3e3;border-radius:8px;padding:12px;margin-bottom:8px">`
        html += `<p style="margin:0 0 4px"><strong>${o.label}</strong> <span style="color:#666;font-size:12px">(${o.frequency}x)</span></p>`
        html += `<p style="margin:0 0 6px;font-size:13px;color:#444">${o.description}</p>`
        if (o.example_quote) {
          html += `<p style="margin:0 0 6px;font-size:12px;color:#666;font-style:italic;border-left:3px solid #E67C00;padding-left:8px">"${o.example_quote}"</p>`
        }
        html += `<p style="margin:0;font-size:12px;color:#047B5D">💬 ${o.recommended_response}</p>`
        html += `</div>`
      }
    }

    // Extreme reviews
    const pos = data.extreme_reviews.positive
    const neg = data.extreme_reviews.negative
    if (pos.length > 0 || neg.length > 0) {
      html += `<h2 style="font-size:16px;margin:20px 0 8px">Avis Extrêmes</h2>`

      if (pos.length > 0) {
        html += `<h3 style="font-size:14px;color:#047B5D;margin-bottom:6px">👍 Ultra positifs</h3>`
        for (const r of pos) {
          html += `<div style="border-left:3px solid #047B5D;padding-left:10px;margin-bottom:10px">`
          html += `<p style="margin:0;font-size:13px;font-style:italic">"${r.quote}"</p>`
          html += `<p style="margin:2px 0 0;font-size:11px;color:#666">— ${r.customer_name} (${r.topic})</p>`
          html += `</div>`
        }
      }

      if (neg.length > 0) {
        html += `<h3 style="font-size:14px;color:#C70A24;margin:12px 0 6px">👎 Ultra négatifs</h3>`
        for (const r of neg) {
          html += `<div style="border-left:3px solid #C70A24;padding-left:10px;margin-bottom:10px">`
          html += `<p style="margin:0;font-size:13px;font-style:italic">"${r.quote}"</p>`
          html += `<p style="margin:2px 0 0;font-size:11px;color:#666">— ${r.customer_name} (${r.topic})</p>`
          html += `</div>`
        }
      }
    }

    html += `<hr style="border:none;border-top:1px solid #e3e3e3;margin:20px 0 10px">`
    html += `<p style="font-size:11px;color:#999;margin:0">Généré par GDL SAV — Analyse IA</p>`
    html += `</div>`
    return html
  }

  function buildEmailText(data: InsightsData, periodLabel: string, ticketsCount: number): string {
    let text = `RAPPORT INSIGHTS SAV — ${periodLabel}\n${ticketsCount} tickets analysés — ${new Date().toLocaleDateString("fr-FR")}\n\n`

    if (data.pain_points.length > 0) {
      text += `=== PAIN POINTS ===\n`
      for (const p of data.pain_points) {
        text += `\n• ${p.label} (${p.frequency}x, ${p.severity})\n  ${p.description}\n`
        if (p.example_quote) text += `  "${p.example_quote}"\n`
        text += `  → ${p.suggested_action}\n`
      }
    }

    if (data.objections.length > 0) {
      text += `\n=== OBJECTIONS ===\n`
      for (const o of data.objections) {
        text += `\n• ${o.label} (${o.frequency}x)\n  ${o.description}\n`
        if (o.example_quote) text += `  "${o.example_quote}"\n`
        text += `  → ${o.recommended_response}\n`
      }
    }

    const pos = data.extreme_reviews.positive
    const neg = data.extreme_reviews.negative
    if (pos.length > 0 || neg.length > 0) {
      text += `\n=== AVIS EXTRÊMES ===\n`
      if (pos.length > 0) {
        text += `\nPositifs:\n`
        for (const r of pos) text += `  "${r.quote}" — ${r.customer_name}\n`
      }
      if (neg.length > 0) {
        text += `\nNégatifs:\n`
        for (const r of neg) text += `  "${r.quote}" — ${r.customer_name}\n`
      }
    }

    return text
  }

  async function handleSendEmail() {
    if (!insights || !emailTo.trim()) return
    if (!emailTo.includes("@")) {
      toast.error("Adresse email invalide")
      return
    }

    setSending(true)
    try {
      const pLabel = getPeriodLabel(period)
      const count = meta?.ticketsAnalyzed ?? 0
      const bodyHtml = buildEmailHtml(insights, pLabel, count)
      const bodyText = buildEmailText(insights, pLabel, count)

      const res = await fetch("/api/gorgias/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: emailTo.trim(),
          customerName: emailTo.trim(),
          subject: `Rapport Insights SAV — ${pLabel}`,
          bodyText,
          bodyHtml,
        }),
      })

      if (res.ok) {
        toast.success(`Rapport envoyé à ${emailTo.trim()}`)
        setEmailTo("")
      } else {
        const err = await res.json()
        toast.error(err.error || "Erreur d'envoi")
      }
    } catch {
      toast.error("Erreur de connexion")
    }
    setSending(false)
  }

  // ─── Chart data ───

  const painPointChartData = useMemo(() => {
    if (!insights) return []
    return insights.pain_points
      .sort((a, b) => b.frequency - a.frequency)
      .map((p) => ({
        label: p.label.length > 30 ? p.label.slice(0, 30) + "..." : p.label,
        frequency: p.frequency,
        severity: p.severity,
      }))
  }, [insights])

  const objectionChartData = useMemo(() => {
    if (!insights) return []
    return insights.objections
      .sort((a, b) => b.frequency - a.frequency)
      .map((o) => ({
        label: o.label.length > 30 ? o.label.slice(0, 30) + "..." : o.label,
        frequency: o.frequency,
      }))
  }, [insights])

  // ─── Loading state ───

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Insights</h1>
          {meta && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Généré le {new Date(meta.generatedAt).toLocaleDateString("fr-FR")} sur {meta.ticketsAnalyzed} tickets
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <div className="flex items-center gap-1.5">
              <Input
                type="email"
                placeholder="Email du destinataire"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="h-8 w-48 text-[12px] bg-card"
                onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
              />
              <Button
                onClick={handleSendEmail}
                disabled={sending || !emailTo.trim()}
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Envoyer
              </Button>
            </div>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            size="sm"
            className="gap-2 bg-[#007AFF] text-white hover:bg-[#007AFF]/90"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Analyse en cours..." : insights ? "Régénérer" : "Générer"}
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              period === opt.value
                ? "bg-[#007AFF] text-white"
                : "bg-[#F5F5F5] text-muted-foreground hover:bg-[#E9E9EB]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Generating state */}
      {generating && (
        <div className="rounded-lg border border-border bg-card p-12 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
            <p className="text-sm font-medium">L&apos;IA analyse les tickets...</p>
            <p className="text-xs text-muted-foreground">Cela peut prendre 10-30 secondes</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!insights && !generating && (
        <div className="rounded-lg border border-border bg-card p-12 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#EAF3FF] flex items-center justify-center mb-3">
              <Lightbulb className="h-6 w-6 text-[#007AFF]" />
            </div>
            <p className="text-sm font-medium">Aucune analyse pour cette période</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Cliquez &quot;Générer&quot; pour que Claude analyse les tickets et identifie les pain points, objections et avis extrêmes.
            </p>
          </div>
        </div>
      )}

      {/* Insights content */}
      {insights && !generating && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={AlertTriangle}
              label="Pain points"
              value={insights.pain_points.length}
              sub={`${insights.pain_points.filter((p) => p.severity === "high").length} critiques`}
              color="#007AFF"
            />
            <KpiCard
              icon={ShieldAlert}
              label="Objections"
              value={insights.objections.length}
              sub={`${insights.objections.reduce((s, o) => s + o.frequency, 0)} occurrences`}
              color="#E67C00"
            />
            <KpiCard
              icon={ThumbsUp}
              label="Avis positifs"
              value={insights.extreme_reviews.positive.length}
              color="#047B5D"
            />
            <KpiCard
              icon={ThumbsDown}
              label="Avis négatifs"
              value={insights.extreme_reviews.negative.length}
              color="#C70A24"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="pain_points">
            <TabsList>
              <TabsTrigger value="pain_points" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Pain Points
              </TabsTrigger>
              <TabsTrigger value="objections" className="gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Objections
              </TabsTrigger>
              <TabsTrigger value="reviews" className="gap-1.5">
                <Quote className="h-3.5 w-3.5" />
                Avis Extrêmes
              </TabsTrigger>
            </TabsList>

            {/* Pain Points tab */}
            <TabsContent value="pain_points" className="space-y-4 mt-4">
              {painPointChartData.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                  <h3 className="text-[13px] font-semibold mb-4">Fréquence des pain points</h3>
                  <ResponsiveContainer width="100%" height={painPointChartData.length * 40 + 20}>
                    <BarChart data={painPointChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={180}
                        tick={{ fontSize: 11, fill: "#616161" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #E3E3E3", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value) => [`${value} occurrences`, "Fréquence"]}
                      />
                      <Bar dataKey="frequency" radius={[0, 4, 4, 0]} barSize={20}>
                        {painPointChartData.map((entry, i) => (
                          <Cell key={i} fill={SEVERITY_COLORS[entry.severity] ?? "#007AFF"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {insights.pain_points.map((point) => (
                  <PainPointCard key={point.id} point={point} />
                ))}
              </div>

              {insights.pain_points.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucun pain point identifié</p>
              )}
            </TabsContent>

            {/* Objections tab */}
            <TabsContent value="objections" className="space-y-4 mt-4">
              {objectionChartData.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                  <h3 className="text-[13px] font-semibold mb-4">Fréquence des objections</h3>
                  <ResponsiveContainer width="100%" height={objectionChartData.length * 40 + 20}>
                    <BarChart data={objectionChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={180}
                        tick={{ fontSize: 11, fill: "#616161" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #E3E3E3", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value) => [`${value} occurrences`, "Fréquence"]}
                      />
                      <Bar dataKey="frequency" radius={[0, 4, 4, 0]} barSize={20} fill="#E67C00" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {insights.objections.map((obj) => (
                  <ObjectionCard key={obj.id} objection={obj} />
                ))}
              </div>

              {insights.objections.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucune objection identifiée</p>
              )}
            </TabsContent>

            {/* Extreme Reviews tab */}
            <TabsContent value="reviews" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Positive */}
                <div>
                  <h3 className="text-[13px] font-semibold flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-[#CDFED4] flex items-center justify-center">
                      <ThumbsUp className="h-3 w-3 text-[#047B5D]" />
                    </div>
                    Ultra positifs
                  </h3>
                  <div className="space-y-3">
                    {insights.extreme_reviews.positive.map((r, i) => (
                      <ExtremeReviewCard key={i} review={r} type="positive" />
                    ))}
                    {insights.extreme_reviews.positive.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">Aucun avis ultra positif identifié</p>
                    )}
                  </div>
                </div>

                {/* Negative */}
                <div>
                  <h3 className="text-[13px] font-semibold flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-[#FEE8EB] flex items-center justify-center">
                      <ThumbsDown className="h-3 w-3 text-[#C70A24]" />
                    </div>
                    Ultra négatifs
                  </h3>
                  <div className="space-y-3">
                    {insights.extreme_reviews.negative.map((r, i) => (
                      <ExtremeReviewCard key={i} review={r} type="negative" />
                    ))}
                    {insights.extreme_reviews.negative.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">Aucun avis ultra négatif identifié</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
