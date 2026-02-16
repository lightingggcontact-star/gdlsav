"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Package,
  TrendingUp,
  FileText,
  ArrowRight,
  Clock,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Mail,
  Star,
  CheckCircle2,
  MessageSquare,
  CircleDot,
  Loader2,
  ChevronDown,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  getReviewStatuses,
  setReviewStatus,
  STATUS_CONFIG,
  type ReviewStatusType,
} from "@/lib/review-status"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { GenerateEmailDialog } from "@/components/generate-email-dialog"
import type { EnrichedOrder } from "@/lib/types"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

// ─── Types ───

interface ShippingResponse {
  orders: EnrichedOrder[]
  stats: { total: number; delayed: number; inTransit: number; delivered: number }
  fetchedAt: string
}

interface CriticalReview {
  submissionId: string
  formId: string
  formName: string
  rating: number
  email: string | null
  customerName: string | null
  feedback: string | null
  submissionDate: string
  allQuestions: { name: string; type: string; value: unknown }[]
}

interface ReviewAnalysis {
  submissionId: string
  urgency: number
  category: string
  suggestedAction: string
}

// ─── Small components ───

function KpiCard({
  label, value, subtitle, icon: Icon, color, href,
}: {
  label: string; value: string | number; subtitle: string
  icon: React.ElementType; color: string; href?: string
}) {
  const content = (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)] group">
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-md p-2" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        {href && <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
      <p className="text-[13px] font-medium text-foreground mt-1">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function StatusBadge({ status, onClick }: { status: ReviewStatusType; onClick?: () => void }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors hover:opacity-80"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {status === "new" && <CircleDot className="h-3 w-3" />}
      {status === "contacted" && <MessageSquare className="h-3 w-3" />}
      {status === "resolved" && <CheckCircle2 className="h-3 w-3" />}
      {cfg.label}
    </button>
  )
}

function CategoryTag({ category }: { category: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    livraison: { bg: "#EAF4FF", text: "#005BD3" },
    qualité: { bg: "#FEE8EB", text: "#C70A24" },
    goût: { bg: "#FFF1E3", text: "#8A6116" },
    emballage: { bg: "#F0E5F7", text: "#6B2D8B" },
    prix: { bg: "#FFF1E3", text: "#8A6116" },
    service: { bg: "#EAF4FF", text: "#005BD3" },
    autre: { bg: "#F1F1F1", text: "#616161" },
  }
  const c = colors[category] ?? colors.autre
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.text }}>
      {category}
    </span>
  )
}

// ─── Ticket Analysis Section ───

type AnalysisPeriod = "this_week" | "last_week" | "this_month" | "custom"

const PERIOD_LABELS: Record<AnalysisPeriod, string> = {
  this_week: "Cette semaine",
  last_week: "Semaine dernière",
  this_month: "Ce mois",
  custom: "Personnalisé",
}

function getPeriodDates(period: AnalysisPeriod, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  switch (period) {
    case "this_week": {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1 // Monday = start
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
    case "custom": {
      return {
        from: customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 86400000),
        to: customTo ? new Date(customTo + "T23:59:59") : to,
      }
    }
  }
}

// (Ticket data is read from Supabase ticket_cache table)

function TicketAnalysisSection() {
  const [period, setPeriod] = useState<AnalysisPeriod>("this_week")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [recap, setRecap] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [learning, setLearning] = useState(false)
  const [learnResult, setLearnResult] = useState<string | null>(null)
  const supabaseAnalysis = useSupabase()

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/gorgias/sync", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setLastSync(`${data.total} tickets (${data.synced} mis à jour)`)
      }
    } catch { /* silent */ }
    setSyncing(false)
  }

  async function handleLearn() {
    setLearning(true)
    setLearnResult(null)
    try {
      const res = await fetch("/api/ai/learn", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setLearnResult(`${data.patterns} patterns appris sur ${data.tickets_analyzed} tickets (${data.categories.join(", ")})`)
      } else {
        const err = await res.json()
        setLearnResult(`Erreur : ${err.error}`)
      }
    } catch {
      setLearnResult("Erreur de connexion.")
    }
    setLearning(false)
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setRecap(null)

    try {
      const { from, to } = getPeriodDates(period, customFrom, customTo)

      // Read from Supabase cache (fast!)
      const { data: cached, error } = await supabaseAnalysis
        .from("ticket_cache")
        .select("*")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(25)

      if (error || !cached || cached.length === 0) {
        setRecap(cached?.length === 0
          ? "Aucun ticket sur cette période. Cliquez 'Sync' pour synchroniser les tickets depuis Gorgias."
          : "Erreur de lecture. Lancez une sync d'abord.")
        setAnalyzing(false)
        return
      }

      // Map to the format expected by the AI API
      const ticketsForRecap = cached.map((t: any) => ({
        id: t.ticket_id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        customerName: t.customer_name,
        customerEmail: t.customer_email,
        createdAt: new Date(t.created_at).toLocaleDateString("fr-FR"),
        tags: t.tags || [],
        firstMessage: t.first_message || "",
        lastMessage: t.last_message || "",
        messageCount: t.message_count || 0,
      }))

      // Call AI
      const res = await fetch("/api/ai/ticket-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets: ticketsForRecap }),
      })

      if (res.ok) {
        const data = await res.json()
        setRecap(data.recap)
      } else {
        setRecap("Erreur lors de l'analyse IA.")
      }
    } catch {
      setRecap("Erreur de connexion.")
    }
    setAnalyzing(false)
  }

  function handleExport() {
    if (!recap) return
    const blob = new Blob([recap], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `recap-sav-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,.05)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-[13px] font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#6B2D8B]" />
          Analyse Messages
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 text-xs h-7"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Sync..." : "Sync tickets"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLearn}
            disabled={learning || syncing}
            className="gap-2 text-xs h-7 border-gdl-purple text-gdl-purple hover:bg-gdl-purple hover:text-white"
          >
            {learning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {learning ? "Apprentissage..." : "Apprendre"}
          </Button>
          {recap && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 text-xs h-7">
              <FileText className="h-3.5 w-3.5" />
              Exporter .md
            </Button>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Period selector */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex gap-1.5">
            {(Object.keys(PERIOD_LABELS) as AnalysisPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                  period === p
                    ? "bg-[#6B2D8B] text-white"
                    : "bg-[#F5F5F5] text-muted-foreground hover:bg-[#E9E9EB]"
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 px-2 text-[12px] border border-border rounded-md bg-background"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 px-2 text-[12px] border border-border rounded-md bg-background"
              />
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            size="sm"
            className="bg-[#6B2D8B] text-white hover:bg-[#6B2D8B]/90 gap-2 h-8"
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {analyzing ? "Analyse en cours..." : "Analyser"}
          </Button>
        </div>

        {/* Result */}
        {analyzing && (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">L&apos;IA analyse les tickets...</span>
          </div>
        )}

        {recap && !analyzing && (
          <div className="rounded-lg border border-border bg-[#FAFAFA] p-5 max-h-[500px] overflow-y-auto">
            <div className="prose prose-sm max-w-none text-[13px] text-foreground leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mb-1 [&_strong]:text-foreground [&_hr]:my-4 [&_hr]:border-border">
              {recap.split("\n").map((line, i) => {
                if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>
                if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>
                if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>
                if (line.startsWith("---")) return <hr key={i} />
                if (line.startsWith("- **")) {
                  const parts = line.slice(2).split("**")
                  return <li key={i}><strong>{parts[1]}</strong>{parts[2] || ""}</li>
                }
                if (line.startsWith("- ")) return <li key={i}>{line.slice(2)}</li>
                if (line.match(/^\d+\.\s/)) return <li key={i}>{line.replace(/^\d+\.\s/, "")}</li>
                if (line.startsWith("*") && line.endsWith("*")) return <p key={i} className="text-xs text-muted-foreground italic">{line.replace(/\*/g, "")}</p>
                if (line.startsWith("**")) {
                  const clean = line.replace(/\*\*/g, "")
                  return <p key={i}><strong>{clean}</strong></p>
                }
                if (line.trim() === "") return <div key={i} className="h-1" />
                return <p key={i}>{line}</p>
              })}
            </div>
          </div>
        )}

        {!recap && !analyzing && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#F3EAFA] flex items-center justify-center mb-3">
              <Mail className="h-5 w-5 text-[#6B2D8B]" />
            </div>
            <p className="text-sm font-medium">Analyse des tickets</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cliquez &quot;Sync tickets&quot; puis sélectionnez une période et cliquez Analyser
            </p>
            {lastSync && (
              <p className="text-[10px] text-muted-foreground/60 mt-2">Dernière sync : {lastSync}</p>
            )}
            {learnResult && (
              <p className="text-[10px] text-gdl-purple mt-1">{learnResult}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───

export default function DashboardPage() {
  const supabase = useSupabase()

  // Shipping state
  const [shippingData, setShippingData] = useState<ShippingResponse | null>(null)
  const [formsCount, setFormsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // SAV state
  const [criticalReviews, setCriticalReviews] = useState<CriticalReview[]>([])
  const [criticalLoading, setCriticalLoading] = useState(true)
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, { status: ReviewStatusType }>>({})
  const [analyses, setAnalyses] = useState<Record<string, ReviewAnalysis>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatusType>("all")

  // AI summary
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Email dialog
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean; customerName: string | null; customerEmail: string | null
    rating: number; feedback: string | null; submissionDate: string; formName: string
  }>({ open: false, customerName: null, customerEmail: null, rating: 1, feedback: null, submissionDate: "", formName: "" })

  // ─── Data fetching ───

  const fetchShipping = useCallback(async () => {
    let thresholdFR = "3"
    let thresholdBE = "5"
    try {
      const { data } = await supabase
        .from("settings")
        .select("threshold_fr, threshold_be")
        .single()
      if (data) {
        thresholdFR = String(data.threshold_fr ?? 3)
        thresholdBE = String(data.threshold_be ?? 5)
      }
    } catch { /* use defaults */ }

    const withTimeout = (promise: Promise<Response>, ms: number) =>
      Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))])

    const [shippingResult, formsResult] = await Promise.allSettled([
      withTimeout(fetch(`/api/shipping?thresholdFR=${thresholdFR}&thresholdBE=${thresholdBE}`), 15000),
      withTimeout(fetch("/api/fillout/forms"), 15000),
    ])

    if (shippingResult.status === "fulfilled" && shippingResult.value.ok) {
      setShippingData(await shippingResult.value.json())
    }
    if (formsResult.status === "fulfilled" && formsResult.value.ok) {
      const data = await formsResult.value.json()
      setFormsCount(data.forms?.filter((f: { isPublished: boolean }) => f.isPublished).length ?? 0)
    }
  }, [supabase])

  const fetchCritical = useCallback(async () => {
    try {
      const res = await fetch("/api/sav/critical")
      if (res.ok) {
        const data = await res.json()
        setCriticalReviews(data.reviews || [])
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    setCriticalLoading(true)
    getReviewStatuses(supabase).then(setReviewStatuses)

    // Load cached analyses
    try {
      const cached = localStorage.getItem("gdl-ai-analyses")
      if (cached) setAnalyses(JSON.parse(cached))
    } catch { /* ignore */ }

    // Load cached AI summary
    try {
      const cached = localStorage.getItem("gdl-ai-summary")
      if (cached) {
        const { summary, timestamp } = JSON.parse(cached)
        // Show cached summary if less than 24h old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setAiSummary(summary)
        }
      }
    } catch { /* ignore */ }

    Promise.all([
      fetchShipping().finally(() => setLoading(false)),
      fetchCritical().finally(() => setCriticalLoading(false)),
    ])
  }, [fetchShipping, fetchCritical, supabase])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchShipping(), fetchCritical()])
    setReviewStatuses(await getReviewStatuses(supabase))
    setRefreshing(false)
  }

  // ─── Status management ───

  async function handleStatusChange(submissionId: string, newStatus: ReviewStatusType) {
    await setReviewStatus(supabase, submissionId, newStatus)
    setReviewStatuses(await getReviewStatuses(supabase))
  }

  async function cycleStatus(submissionId: string) {
    const current = reviewStatuses[submissionId]?.status ?? "new"
    const next: ReviewStatusType = current === "new" ? "contacted" : current === "contacted" ? "resolved" : "new"
    await handleStatusChange(submissionId, next)
  }

  // ─── AI Analysis ───

  async function handleAnalyze() {
    if (criticalReviews.length === 0) return
    setAnalyzing(true)
    try {
      const res = await fetch("/api/ai/analyze-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews: criticalReviews.slice(0, 50).map((r) => ({
            submissionId: r.submissionId,
            rating: r.rating,
            feedback: r.feedback,
            customerName: r.customerName,
            submissionDate: r.submissionDate,
            formName: r.formName,
          })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, ReviewAnalysis> = {}
        for (const a of data.analyses) map[a.submissionId] = a
        setAnalyses(map)
        localStorage.setItem("gdl-ai-analyses", JSON.stringify(map))
      }
    } catch { /* silent */ }
    setAnalyzing(false)
  }

  async function handleWeeklySummary() {
    setSummaryLoading(true)
    try {
      // Calculate avg rating from critical reviews (we only have critical ones, but show the data)
      const ratings = criticalReviews.map((r) => r.rating)
      const avg = ratings.length > 0 ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null

      const res = await fetch("/api/ai/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews: criticalReviews.slice(0, 30).map((r) => ({
            rating: r.rating,
            feedback: r.feedback,
            formName: r.formName,
            submissionDate: r.submissionDate,
            category: analyses[r.submissionId]?.category,
          })),
          totalReviews: criticalReviews.length,
          avgRating: avg,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSummary(data.summary)
        localStorage.setItem("gdl-ai-summary", JSON.stringify({ summary: data.summary, timestamp: Date.now() }))
      }
    } catch { /* silent */ }
    setSummaryLoading(false)
  }

  // ─── Computed ───

  const stats = shippingData?.stats ?? { total: 0, delayed: 0, inTransit: 0, delivered: 0 }
  const delayedOrders = shippingData?.orders.filter((o) => o.alertLevel === "delayed").slice(0, 5) ?? []

  const untreatedCount = criticalReviews.filter((r) => {
    const s = reviewStatuses[r.submissionId]?.status
    return !s || s === "new"
  }).length

  const filteredReviews = useMemo(() => {
    let list = criticalReviews
    if (statusFilter !== "all") {
      list = list.filter((r) => {
        const s = reviewStatuses[r.submissionId]?.status ?? "new"
        return s === statusFilter
      })
    }
    // Sort by urgency (if analyzed) then by date
    return [...list].sort((a, b) => {
      const ua = analyses[a.submissionId]?.urgency ?? 0
      const ub = analyses[b.submissionId]?.urgency ?? 0
      if (ua !== ub) return ub - ua
      return new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    })
  }, [criticalReviews, statusFilter, reviewStatuses, analyses])

  const chartData = [
    { name: "Retards", value: stats.delayed, fill: "#C70A24" },
    { name: "En transit", value: stats.inTransit, fill: "#E67C00" },
    { name: "Livrés", value: stats.delivered, fill: "#047B5D" },
  ]

  // ─── Render ───

  if (loading && criticalLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
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
          <h1 className="text-xl font-semibold">Dashboard SAV</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Graine de Lascars — Vue d&apos;ensemble
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Rafraîchir
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Avis critiques"
          value={untreatedCount}
          subtitle={`${criticalReviews.length} total · ${untreatedCount} non traités`}
          icon={AlertTriangle}
          color="#C70A24"
        />
        <KpiCard
          label="Retards livraison"
          value={stats.delayed}
          subtitle={`${stats.total} commandes suivies`}
          icon={Package}
          color="#E67C00"
          href="/shipping"
        />
        <KpiCard
          label="En transit"
          value={stats.inTransit}
          subtitle={`${stats.delivered} livrés`}
          icon={TrendingUp}
          color="#005BD3"
          href="/shipping"
        />
        <KpiCard
          label="Formulaires"
          value={formsCount}
          subtitle="Fillout publiés"
          icon={FileText}
          color="#047B5D"
          href="/forms"
        />
      </div>

      {/* ═══ SAV Queue ═══ */}
      <div className="rounded-lg border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#FEE8EB]">
              <AlertTriangle className="h-4 w-4 text-[#C70A24]" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold">File d&apos;attente SAV</h2>
              <p className="text-[11px] text-muted-foreground">{criticalReviews.length} avis critiques · cliquer sur le statut pour changer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-card h-8">
              {([
                ["all", "Tous", null],
                ["new", "Nouveaux", "#C70A24"],
                ["contacted", "Contactés", "#8A6116"],
                ["resolved", "Résolus", "#047B5D"],
              ] as const).map(([key, label, color]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key as typeof statusFilter)}
                  className={cn(
                    "h-full px-2.5 text-[11px] font-medium transition-colors border-r border-border last:border-r-0 flex items-center gap-1",
                    statusFilter === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  {color && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
                  {key === "all" && <Filter className="h-3 w-3" />}
                  {label}
                </button>
              ))}
            </div>
            {/* AI Analyze button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing || criticalReviews.length === 0}
              className="gap-1.5 h-8 text-[11px] border-gdl-purple text-gdl-purple hover:bg-gdl-purple hover:text-white"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {analyzing ? "Analyse..." : Object.keys(analyses).length > 0 ? "Re-analyser" : "Analyser (IA)"}
            </Button>
          </div>
        </div>

        {/* Queue list */}
        {criticalLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Chargement des avis critiques...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#CDFED4] flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-5 w-5 text-[#047B5D]" />
            </div>
            <p className="text-sm font-medium">
              {statusFilter === "all" ? "Aucun avis critique" : `Aucun avis "${STATUS_CONFIG[statusFilter as ReviewStatusType]?.label ?? statusFilter}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {filteredReviews.map((review) => {
              const status = reviewStatuses[review.submissionId]?.status ?? "new"
              const analysis = analyses[review.submissionId]
              const isRecent = Date.now() - new Date(review.submissionDate).getTime() < 14 * 24 * 60 * 60 * 1000

              return (
                <div key={review.submissionId} className={cn(
                  "px-5 py-3.5 flex items-start gap-3 transition-colors",
                  status === "resolved" ? "opacity-60" : "hover:bg-secondary/30"
                )}>
                  {/* Urgency indicator */}
                  {analysis && (
                    <div className={cn(
                      "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white",
                      analysis.urgency >= 8 ? "bg-[#C70A24]" : analysis.urgency >= 5 ? "bg-[#E67C00]" : "bg-[#D97706]"
                    )}>
                      {analysis.urgency}
                    </div>
                  )}

                  {/* Rating badge */}
                  <div className={cn(
                    "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[12px]",
                    review.rating <= 2 ? "bg-[#FEE8EB] text-[#C70A24]" : "bg-[#FFF1E3] text-[#8A6116]"
                  )}>
                    {review.rating}/5
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <StatusBadge status={status} onClick={() => cycleStatus(review.submissionId)} />
                      {analysis && <CategoryTag category={analysis.category} />}
                      {isRecent && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EAF4FF] text-[#005BD3]">Récent</span>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(review.submissionDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-0.5">
                      {review.customerName && <span className="text-[13px] font-medium">{review.customerName}</span>}
                      {review.email && (
                        <span className="text-[12px] text-muted-foreground truncate">{review.email}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">· {review.formName}</span>
                    </div>
                    {review.feedback && (
                      <p className="text-[12px] text-muted-foreground line-clamp-1">&ldquo;{review.feedback}&rdquo;</p>
                    )}
                    {analysis?.suggestedAction && (
                      <p className="text-[11px] text-gdl-purple mt-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        {analysis.suggestedAction}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEmailDialog({
                        open: true,
                        customerName: review.customerName,
                        customerEmail: review.email,
                        rating: review.rating,
                        feedback: review.feedback,
                        submissionDate: review.submissionDate,
                        formName: review.formName,
                      })}
                      className="p-1.5 rounded-md text-white bg-gdl-purple hover:bg-[#5a2574] transition-colors"
                      title="Générer email IA"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    {review.email && (
                      <a
                        href={`mailto:${review.email}`}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-gdl-purple hover:bg-[#F0E5F7] transition-colors"
                        title="Email direct"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {review.email && (
                      <a
                        href={`https://admin.shopify.com/store/grainedelascars/customers?query=${encodeURIComponent(review.email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Shopify"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Link
                      href={`/forms/${review.formId}`}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Voir le formulaire"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ Two-column: AI Summary + Shipping ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Weekly Summary */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gdl-purple" />
              Résumé IA
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWeeklySummary}
              disabled={summaryLoading || criticalReviews.length === 0}
              className="gap-1.5 h-7 text-[11px]"
            >
              {summaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {aiSummary ? "Actualiser" : "Générer"}
            </Button>
          </div>
          {summaryLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-gdl-purple" />
              <p className="text-[12px] text-muted-foreground">Claude analyse vos données...</p>
            </div>
          ) : aiSummary ? (
            <div className="prose prose-sm max-w-none text-[13px] text-foreground leading-relaxed [&_strong]:text-foreground [&_p]:mb-2 [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-1">
              {aiSummary.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-semibold text-foreground mt-3 first:mt-0">{line.replace(/\*\*/g, "")}</p>
                }
                if (line.startsWith("- ")) {
                  return <p key={i} className="text-muted-foreground pl-3 border-l-2 border-border">{line.slice(2)}</p>
                }
                if (line.match(/^\d+\./)) {
                  return <p key={i} className="text-foreground">{line}</p>
                }
                if (line.trim() === "") return null
                return <p key={i}>{line}</p>
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[#F0E5F7] flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-gdl-purple" />
              </div>
              <p className="text-sm font-medium">Résumé IA hebdomadaire</p>
              <p className="text-xs text-muted-foreground mt-1">
                Claude analysera vos avis et identifiera les tendances
              </p>
            </div>
          )}
        </div>

        {/* Shipping overview */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#C70A24]" />
              Livraisons en retard
            </h2>
            {delayedOrders.length > 0 && (
              <Link href="/shipping" className="text-xs text-[#005BD3] hover:underline flex items-center gap-1">
                Voir tout <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {stats.total > 0 ? (
            <div className="space-y-4">
              {/* Mini chart */}
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: "#616161" }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #E3E3E3", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value) => [`${value} commandes`, ""]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Delayed list */}
              {delayedOrders.length > 0 && (
                <div className="space-y-0">
                  {delayedOrders.map((order) => {
                    const shopifyNumericId = order.id.split("/").pop()
                    return (
                      <div key={order.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0 text-[12px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C70A24] shrink-0" />
                        <span className="font-medium truncate">{order.customerName}</span>
                        <span className="text-muted-foreground">{order.orderName}</span>
                        <Badge variant="outline" className="bg-[#FEE8EB] text-[#C70A24] border-transparent text-[10px] ml-auto shrink-0">
                          {order.businessDaysElapsed}j
                        </Badge>
                        <a
                          href={`https://admin.shopify.com/store/grainedelascars/orders/${shopifyNumericId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[#CDFED4] flex items-center justify-center mb-3">
                <Package className="h-5 w-5 text-[#047B5D]" />
              </div>
              <p className="text-sm font-medium">Aucun retard</p>
              <p className="text-xs text-muted-foreground mt-1">Toutes les commandes sont dans les temps</p>
            </div>
          )}
        </div>
      </div>

      {/* Analyse Messages IA */}
      <TicketAnalysisSection />

      {/* Email Dialog */}
      <GenerateEmailDialog
        open={emailDialog.open}
        onClose={() => setEmailDialog((prev) => ({ ...prev, open: false }))}
        customerName={emailDialog.customerName}
        customerEmail={emailDialog.customerEmail}
        rating={emailDialog.rating}
        feedback={emailDialog.feedback}
        formName={emailDialog.formName}
        submissionDate={emailDialog.submissionDate}
      />
    </div>
  )
}
