"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  RefreshCw,
  Search,
  ArrowLeft,
  Copy,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Users,
  TrendingUp,
  Hash,
  Table2,
  BarChart3,
  AlertTriangle,
  Mail,
  ExternalLink,
  Star,
  Filter,
  Sparkles,
  CircleDot,
  MessageSquare,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { GenerateEmailDialog } from "@/components/generate-email-dialog"
import {
  getReviewStatuses,
  setReviewStatus as setStoredReviewStatus,
  STATUS_CONFIG,
  type ReviewStatusType,
} from "@/lib/review-status"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts"

// ─── Types ───

interface FilloutQuestion {
  id: string
  name: string
  type: string
  value: unknown
}

interface UrlParameter {
  id: string
  name: string
  value: string
}

interface FilloutSubmission {
  submissionId: string
  submissionTime: string
  lastUpdatedAt: string
  questions: FilloutQuestion[]
  urlParameters?: UrlParameter[]
}

interface FormMeta {
  id: string
  name: string
  questions: { id: string; name: string; type: string }[]
}

type Tab = "analytics" | "data"
type SortDir = "asc" | "desc"

const CHART_COLORS = [
  "#007AFF", "#005BD3", "#047B5D", "#E67C00", "#C70A24",
  "#8B5CF6", "#0891B2", "#059669", "#D97706", "#DC2626",
  "#A855F7", "#06B6D4", "#10B981", "#F59E0B", "#EF4444",
]

const RATING_COLORS: Record<number, string> = {
  1: "#C70A24", 2: "#E67C00", 3: "#D97706", 4: "#047B5D", 5: "#047B5D",
}

function getEmail(sub: FilloutSubmission): string | null {
  // Try urlParameters first (most common for satisfaction forms)
  const fromUrl = sub.urlParameters?.find((p) => p.name.toLowerCase() === "email")?.value
  if (fromUrl) return fromUrl
  // Fallback: look for an email question
  const emailQ = sub.questions.find((q) => q.type === "EmailAddress" || /e-?mail/i.test(q.name))
  if (emailQ?.value && typeof emailQ.value === "string") return emailQ.value
  return null
}

function getRating(sub: FilloutSubmission): number | null {
  const ratingQ = sub.questions.find((q) => q.type === "OpinionScale")
  if (ratingQ?.value != null && typeof ratingQ.value === "number") return ratingQ.value
  return null
}

// ─── Main Page ───

export default function FormDetailPage() {
  const supabase = useSupabase()
  const { formId } = useParams<{ formId: string }>()
  const [formMeta, setFormMeta] = useState<FormMeta | null>(null)
  const [submissions, setSubmissions] = useState<FilloutSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>("analytics")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState("submissionTime")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedSubmission, setSelectedSubmission] = useState<FilloutSubmission | null>(null)
  const [ratingFilter, setRatingFilter] = useState<"all" | "critical" | "good">("all")
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean
    customerName: string | null
    customerEmail: string | null
    rating: number
    feedback: string | null
    submissionDate: string
  }>({ open: false, customerName: null, customerEmail: null, rating: 1, feedback: null, submissionDate: "" })
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, { status: ReviewStatusType }>>({})

  useEffect(() => {
    async function loadStatuses() {
      setReviewStatuses(await getReviewStatuses(supabase))
    }
    loadStatuses()
  }, [supabase])

  async function cycleStatus(submissionId: string) {
    const current = reviewStatuses[submissionId]?.status ?? "new"
    const next: ReviewStatusType = current === "new" ? "contacted" : current === "contacted" ? "resolved" : "new"
    await setStoredReviewStatus(supabase, submissionId, next)
    setReviewStatuses(await getReviewStatuses(supabase))
  }

  const fetchData = useCallback(async () => {
    try {
      const [metaRes, subsRes] = await Promise.all([
        fetch(`/api/fillout/forms/${formId}`),
        fetch(`/api/fillout/forms/${formId}/submissions`),
      ])
      if (!metaRes.ok) {
        const body = await metaRes.json()
        throw new Error(body.error ?? "Erreur formulaire")
      }
      if (!subsRes.ok) {
        const body = await subsRes.json()
        throw new Error(body.error ?? "Erreur soumissions")
      }
      const meta: FormMeta = await metaRes.json()
      const subsData = await subsRes.json()
      setFormMeta(meta)
      setSubmissions(subsData.responses || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    }
  }, [formId])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // ─── Analytics data ───

  // Submissions over time (grouped by week)
  const timelineData = useMemo(() => {
    if (submissions.length === 0) return []
    const weeks: Record<string, number> = {}
    for (const sub of submissions) {
      const d = new Date(sub.submissionTime)
      // Start of week (Monday)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const weekStart = new Date(d.setDate(diff))
      const key = weekStart.toISOString().slice(0, 10)
      weeks[key] = (weeks[key] || 0) + 1
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        count,
      }))
  }, [submissions])

  // Distribution charts for choice-based questions
  const choiceCharts = useMemo(() => {
    if (!formMeta || submissions.length === 0) return []
    const chartTypes = new Set(["ImagePicker", "Dropdown", "MultipleChoice"])
    return formMeta.questions
      .filter((q) => chartTypes.has(q.type))
      .map((q) => {
        const counts: Record<string, number> = {}
        for (const sub of submissions) {
          const val = sub.questions.find((sq) => sq.id === q.id)?.value
          if (!val) continue
          const values = Array.isArray(val) ? val : [val]
          for (const v of values) {
            const key = String(v)
            counts[key] = (counts[key] || 0) + 1
          }
        }
        const data = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .map(([name, value], i) => ({
            name,
            value,
            fill: CHART_COLORS[i % CHART_COLORS.length],
          }))
        return { questionName: q.name, data, total: data.reduce((s, d) => s + d.value, 0) }
      })
      .filter((c) => c.data.length > 0)
  }, [formMeta, submissions])

  // Checkbox stats (yes/no)
  const checkboxCharts = useMemo(() => {
    if (!formMeta || submissions.length === 0) return []
    return formMeta.questions
      .filter((q) => q.type === "Checkbox")
      .map((q) => {
        let yes = 0, no = 0
        for (const sub of submissions) {
          const val = sub.questions.find((sq) => sq.id === q.id)?.value
          if (val === true) yes++
          else no++
        }
        return {
          questionName: q.name,
          data: [
            { name: "Oui", value: yes, fill: "#047B5D" },
            { name: "Non", value: no, fill: "#E3E3E3" },
          ],
          yesPct: Math.round((yes / (yes + no)) * 100),
        }
      })
  }, [formMeta, submissions])

  // Satisfaction charts for OpinionScale questions
  const satisfactionCharts = useMemo(() => {
    if (!formMeta || submissions.length === 0) return []
    return formMeta.questions
      .filter((q) => q.type === "OpinionScale")
      .map((q) => {
        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        let total = 0
        for (const sub of submissions) {
          const val = sub.questions.find((sq) => sq.id === q.id)?.value
          if (val != null && typeof val === "number" && val >= 1 && val <= 5) {
            distribution[val]++
            total++
          }
        }
        if (total === 0) return null
        const satisfied = distribution[4] + distribution[5]
        const satisfiedPct = Math.round((satisfied / total) * 100)
        const avg = Object.entries(distribution).reduce((s, [k, v]) => s + Number(k) * v, 0) / total
        const data = [1, 2, 3, 4, 5].map((n) => ({
          name: `${n}`,
          value: distribution[n],
          fill: RATING_COLORS[n],
          pct: Math.round((distribution[n] / total) * 100),
        }))
        return { questionName: q.name, data, total, satisfiedPct, avg: Math.round(avg * 10) / 10 }
      })
      .filter(Boolean) as { questionName: string; data: { name: string; value: number; fill: string; pct: number }[]; total: number; satisfiedPct: number; avg: number }[]
  }, [formMeta, submissions])

  // Critical responses (rating ≤ 3) — for forms with OpinionScale
  const criticalResponses = useMemo(() => {
    if (!formMeta || submissions.length === 0) return []
    const hasOpinionScale = formMeta.questions.some((q) => q.type === "OpinionScale")
    if (!hasOpinionScale) return []

    return (submissions
      .map((sub) => {
        const rating = getRating(sub)
        if (rating === null || rating > 3) return null
        const email = getEmail(sub)
        // Get first text answer as summary
        const textQ = sub.questions.find((q) =>
          (q.type === "ShortAnswer" || q.type === "LongAnswer") && q.value
        )
        return {
          submission: sub,
          rating,
          email,
          summary: textQ ? String(textQ.value).slice(0, 100) : null,
          date: sub.submissionTime,
        }
      })
      .filter(Boolean) as { submission: FilloutSubmission; rating: number; email: string | null; summary: string | null; date: string }[])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [formMeta, submissions])

  // Overall satisfaction KPI (first OpinionScale)
  const satisfactionKpi = useMemo(() => {
    if (satisfactionCharts.length === 0) return null
    const main = satisfactionCharts[0]
    return { avg: main.avg, satisfiedPct: main.satisfiedPct, total: main.total, criticalCount: criticalResponses.length }
  }, [satisfactionCharts, criticalResponses])

  // KPI cards
  const kpis = useMemo(() => {
    if (submissions.length === 0) return null
    const dates = submissions.map((s) => new Date(s.submissionTime).getTime())
    const oldest = new Date(Math.min(...dates))
    const newest = new Date(Math.max(...dates))
    const daySpan = Math.max(1, Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)))
    const avgPerDay = (submissions.length / daySpan).toFixed(1)

    // Last 7 days count
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000
    const last7 = submissions.filter((s) => new Date(s.submissionTime).getTime() > week).length

    return { total: submissions.length, avgPerDay, last7, daySpan }
  }, [submissions])

  // ─── Data tab helpers ───

  const visibleColumns = useMemo(() => {
    if (!formMeta) return []
    const skip = new Set(["Checkbox"])
    return formMeta.questions.filter((q) => !skip.has(q.type)).slice(0, 4)
  }, [formMeta])

  function getVal(sub: FilloutSubmission, questionId: string): string {
    const q = sub.questions.find((q) => q.id === questionId)
    if (!q || q.value === null || q.value === undefined) return "—"
    if (Array.isArray(q.value)) return q.value.join(", ")
    if (typeof q.value === "boolean") return q.value ? "Oui" : "Non"
    return String(q.value)
  }

  const hasOpinionScale = formMeta?.questions.some((q) => q.type === "OpinionScale") ?? false

  const filtered = useMemo(() => {
    let result = submissions
    // Rating filter
    if (ratingFilter === "critical") {
      result = result.filter((sub) => {
        const r = getRating(sub)
        return r !== null && r <= 3
      })
    } else if (ratingFilter === "good") {
      result = result.filter((sub) => {
        const r = getRating(sub)
        return r !== null && r >= 4
      })
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((sub) =>
        sub.questions.some((question) => {
          const val = question.value
          if (!val) return false
          if (Array.isArray(val)) return val.some((v) => String(v).toLowerCase().includes(q))
          return String(val).toLowerCase().includes(q)
        })
      )
    }
    result = [...result].sort((a, b) => {
      if (sortField === "submissionTime") {
        const da = new Date(a.submissionTime).getTime()
        const db = new Date(b.submissionTime).getTime()
        return sortDir === "asc" ? da - db : db - da
      }
      const va = getVal(a, sortField).toLowerCase()
      const vb = getVal(b, sortField).toLowerCase()
      const cmp = va.localeCompare(vb)
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [submissions, searchQuery, sortField, sortDir, ratingFilter])

  function toggleSort(field: string) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return null
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />
  }

  // ─── Render ───

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Formulaires
        </Link>
        <div className="rounded-lg border border-border bg-[#FEE8EB] p-8 text-center">
          <p className="text-[#C70A24] font-medium">{error}</p>
          <Button variant="outline" className="mt-4 bg-card" onClick={() => { setLoading(true); setError(null); fetchData().finally(() => setLoading(false)) }}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Formulaires
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{formMeta?.name}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {submissions.length} réponse{submissions.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border border-border rounded-lg overflow-hidden bg-card w-fit">
        {([["analytics", "Analyse", BarChart3], ["data", "Données", Table2]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 h-9 px-4 text-[13px] font-medium transition-colors border-r border-border last:border-r-0",
              tab === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ Analytics Tab ═══ */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* KPI cards — with satisfaction if available */}
          {kpis && (
            <div className={cn("grid gap-3", satisfactionKpi ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
              <KpiCard icon={Users} label="Total réponses" value={kpis.total} color="#007AFF" />
              <KpiCard icon={TrendingUp} label="7 derniers jours" value={kpis.last7} color="#005BD3" />
              {satisfactionKpi ? (
                <>
                  <KpiCard
                    icon={Star}
                    label="Satisfaction"
                    value={`${satisfactionKpi.satisfiedPct}%`}
                    color={satisfactionKpi.satisfiedPct >= 70 ? "#047B5D" : satisfactionKpi.satisfiedPct >= 50 ? "#E67C00" : "#C70A24"}
                  />
                  <KpiCard
                    icon={AlertTriangle}
                    label="Réponses critiques"
                    value={satisfactionKpi.criticalCount}
                    color={satisfactionKpi.criticalCount > 0 ? "#C70A24" : "#047B5D"}
                  />
                </>
              ) : (
                <KpiCard icon={Hash} label="Moyenne / jour" value={kpis.avgPerDay} color="#047B5D" />
              )}
            </div>
          )}

          {/* Satisfaction breakdown — grid of % blocks */}
          {satisfactionCharts.map((chart) => (
            <div key={chart.questionName} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold">{chart.questionName}</h3>
                <span className="text-[12px] text-muted-foreground">{chart.total} réponses · moy. {chart.avg}/5</span>
              </div>

              {/* Big satisfaction donut + grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3">
                {/* Donut card */}
                <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)] flex items-center justify-center">
                  <div className="relative w-36 h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Satisfaits", value: chart.data.filter((d) => Number(d.name) >= 4).reduce((s, d) => s + d.value, 0), fill: "#047B5D" },
                            { name: "Neutres", value: chart.data.find((d) => d.name === "3")?.value || 0, fill: "#D97706" },
                            { name: "Insatisfaits", value: chart.data.filter((d) => Number(d.name) <= 2).reduce((s, d) => s + d.value, 0), fill: "#C70A24" },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={62}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="#fff"
                        >
                          {[
                            { name: "Satisfaits", value: chart.data.filter((d) => Number(d.name) >= 4).reduce((s, d) => s + d.value, 0), fill: "#047B5D" },
                            { name: "Neutres", value: chart.data.find((d) => d.name === "3")?.value || 0, fill: "#D97706" },
                            { name: "Insatisfaits", value: chart.data.filter((d) => Number(d.name) <= 2).reduce((s, d) => s + d.value, 0), fill: "#C70A24" },
                          ].filter((d) => d.value > 0).map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: chart.satisfiedPct >= 70 ? "#047B5D" : chart.satisfiedPct >= 50 ? "#D97706" : "#C70A24" }}>
                        {chart.satisfiedPct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">satisfaits</span>
                    </div>
                  </div>
                </div>

                {/* Grid of 5 rating blocks */}
                <div className="grid grid-cols-5 gap-2">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const item = chart.data.find((d) => d.name === String(n))!
                    const label = n >= 4 ? "Satisfait" : n === 3 ? "Neutre" : "Insatisfait"
                    const bgColor = n >= 4 ? "#CDFED4" : n === 3 ? "#FFF1E3" : "#FEE8EB"
                    const textColor = n >= 4 ? "#047B5D" : n === 3 ? "#8A6116" : "#C70A24"
                    return (
                      <div key={n} className="rounded-lg border border-border bg-card p-3 shadow-[0_1px_0_0_rgba(0,0,0,.05)] flex flex-col items-center text-center">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold mb-2" style={{ backgroundColor: bgColor, color: textColor }}>
                          {n}
                        </div>
                        <span className="text-xl font-bold" style={{ color: textColor }}>{item.pct}%</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">{item.value} rép.</span>
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* ─── Critical responses (≤3) ─── */}
          {criticalResponses.length > 0 && (
            <div className="rounded-lg border border-[#FEE8EB] bg-card shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-[#FEE8EB]">
                  <AlertTriangle className="h-4 w-4 text-[#C70A24]" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold">Réponses critiques ({criticalResponses.length})</h3>
                  <p className="text-[11px] text-muted-foreground">Notes de 1 à 3 — clients à contacter</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {criticalResponses.map((cr) => (
                  <div key={cr.submission.submissionId} className="px-5 py-3.5 flex items-start gap-4 hover:bg-secondary/30 transition-colors">
                    {/* Rating badge */}
                    <div className={cn(
                      "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                      cr.rating <= 2 ? "bg-[#FEE8EB] text-[#C70A24]" : "bg-[#FFF1E3] text-[#8A6116]"
                    )}>
                      {cr.rating}/5
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {(() => {
                          const st = reviewStatuses[cr.submission.submissionId]?.status ?? "new"
                          const cfg = STATUS_CONFIG[st]
                          return (
                            <button
                              onClick={() => cycleStatus(cr.submission.submissionId)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold hover:opacity-80"
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}
                            >
                              {st === "new" && <CircleDot className="h-2.5 w-2.5" />}
                              {st === "contacted" && <MessageSquare className="h-2.5 w-2.5" />}
                              {st === "resolved" && <CheckCircle2 className="h-2.5 w-2.5" />}
                              {cfg.label}
                            </button>
                          )
                        })()}
                        <span className="text-[12px] text-muted-foreground">
                          {new Date(cr.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn("h-3 w-3", n <= cr.rating ? "fill-[#E67C00] text-[#E67C00]" : "text-border")} />
                        ))}
                      </div>
                      {cr.email && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[13px] font-medium">{cr.email}</span>
                        </div>
                      )}
                      {cr.summary && (
                        <p className="text-[13px] text-muted-foreground truncate">{cr.summary}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEmailDialog({
                          open: true,
                          customerName: (() => {
                            const nameQ = cr.submission.questions.find((q) => q.type === "ShortAnswer" && /pr[ée]nom/i.test(q.name))
                            return nameQ?.value ? String(nameQ.value) : null
                          })(),
                          customerEmail: cr.email,
                          rating: cr.rating,
                          feedback: cr.summary,
                          submissionDate: cr.date,
                        })}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium bg-gdl-purple text-white hover:bg-[#005FCC] transition-colors"
                      >
                        <Sparkles className="h-3 w-3" /> Email IA
                      </button>
                      {cr.email && (
                        <a
                          href={`mailto:${cr.email}`}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium bg-[#EAF3FF] text-gdl-purple hover:bg-gdl-purple hover:text-white transition-colors"
                        >
                          <Mail className="h-3 w-3" /> Contacter
                        </a>
                      )}
                      {cr.email && (
                        <a
                          href={`https://admin.shopify.com/store/grainedelascars/customers?query=${encodeURIComponent(cr.email)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" /> Shopify
                        </a>
                      )}
                      <button
                        onClick={() => setSelectedSubmission(cr.submission)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
                      >
                        Voir tout
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {timelineData.length > 1 && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
              <h3 className="text-[13px] font-semibold mb-4">Réponses par semaine</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={timelineData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#616161" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#616161" }} axisLine={false} tickLine={false} width={30} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #E3E3E3", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v) => [`${v} réponses`, ""]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#007AFF" fill="#007AFF" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Choice distribution charts */}
          {choiceCharts.map((chart) => (
            <div key={chart.questionName} className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
              <h3 className="text-[13px] font-semibold mb-4">{chart.questionName}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
                {/* Bar chart */}
                <ResponsiveContainer width="100%" height={Math.max(180, chart.data.length * 36)}>
                  <BarChart data={chart.data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 12, fill: "#303030" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #E3E3E3", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v, _n, props) => {
                        const pct = Math.round((Number(v) / chart.total) * 100)
                        return [`${v} (${pct}%)`, props.payload.name]
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {chart.data.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Pie chart with % labels */}
                {chart.data.length <= 12 && (
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <ResponsiveContainer width={220} height={220}>
                        <PieChart>
                          <Pie
                            data={chart.data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            dataKey="value"
                            strokeWidth={2}
                            stroke="#fff"
                            label={({ name, value }) => {
                              const pct = Math.round((value / chart.total) * 100)
                              return pct >= 5 ? `${pct}%` : ""
                            }}
                            labelLine={false}
                          >
                            {chart.data.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "#fff", border: "1px solid #E3E3E3", borderRadius: "8px", fontSize: "12px" }}
                            formatter={(v) => {
                              const pct = Math.round((Number(v) / chart.total) * 100)
                              return [`${v} (${pct}%)`, ""]
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Checkbox charts */}
          {checkboxCharts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {checkboxCharts.map((chart) => (
                <div key={chart.questionName} className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                  <h3 className="text-[13px] font-semibold mb-3 line-clamp-2">{chart.questionName}</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chart.data} cx="50%" cy="50%" innerRadius={25} outerRadius={38} dataKey="value" strokeWidth={0}>
                            {chart.data.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold">
                        {chart.yesPct}%
                      </span>
                    </div>
                    <div className="space-y-1 text-[13px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#047B5D]" />
                        Oui : {chart.data[0].value}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E3E3E3]" />
                        Non : {chart.data[1].value}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {submissions.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground text-sm">Aucune réponse pour ce formulaire</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Data Tab ═══ */}
      {tab === "data" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative sm:max-w-sm flex-1 min-w-50">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border h-9 text-sm"
              />
            </div>
            {hasOpinionScale && (
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-card h-9">
                {([
                  ["all", "Tous", null],
                  ["critical", "≤ 3", "#C70A24"],
                  ["good", "4-5", "#047B5D"],
                ] as const).map(([key, label, color]) => (
                  <button
                    key={key}
                    onClick={() => setRatingFilter(key)}
                    className={cn(
                      "h-full px-3 text-[12px] font-medium transition-colors border-r border-border last:border-r-0 flex items-center gap-1.5",
                      ratingFilter === key
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                    {key === "all" && <Filter className="h-3 w-3" />}
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="h-9 px-3 rounded-lg border border-border bg-card text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex items-center gap-1.5"
            >
              {sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {sortDir === "desc" ? "Récents" : "Anciens"}
            </button>
          </div>

          <p className="text-[12px] text-muted-foreground">
            {filtered.length} réponse{filtered.length > 1 ? "s" : ""}
            {ratingFilter !== "all" && ` · filtre: ${ratingFilter === "critical" ? "≤ 3 étoiles" : "4-5 étoiles"}`}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground text-sm">Aucune réponse trouvée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((sub) => {
                const rating = getRating(sub)
                const email = getEmail(sub)
                const nameQ = sub.questions.find((q) => q.type === "ShortAnswer" && /pr[ée]nom/i.test(q.name))
                const lastNameQ = sub.questions.find((q) => q.type === "ShortAnswer" && /nom/i.test(q.name) && !/pr[ée]nom/i.test(q.name))
                const name = [nameQ?.value, lastNameQ?.value].filter(Boolean).join(" ")
                const textQ = sub.questions.find((q) => (q.type === "ShortAnswer" || q.type === "LongAnswer") && q.value && !/pr[ée]nom|nom|e-?mail/i.test(q.name))

                return (
                  <div
                    key={sub.submissionId}
                    onClick={() => setSelectedSubmission(sub)}
                    className={cn(
                      "rounded-lg border bg-card p-4 cursor-pointer hover:shadow-md transition-all",
                      rating !== null && rating <= 2 ? "border-[#FEE8EB]" : rating === 3 ? "border-[#FFF1E3]" : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Rating badge */}
                      {rating !== null && (
                        <div className={cn(
                          "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                          rating >= 4 ? "bg-[#CDFED4] text-[#047B5D]" : rating === 3 ? "bg-[#FFF1E3] text-[#8A6116]" : "bg-[#FEE8EB] text-[#C70A24]"
                        )}>
                          {rating}/5
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {rating !== null && rating <= 3 && (() => {
                            const st = reviewStatuses[sub.submissionId]?.status ?? "new"
                            const cfg = STATUS_CONFIG[st]
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); cycleStatus(sub.submissionId) }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold hover:opacity-80"
                                style={{ backgroundColor: cfg.bg, color: cfg.color }}
                              >
                                {st === "new" && <CircleDot className="h-2.5 w-2.5" />}
                                {st === "contacted" && <MessageSquare className="h-2.5 w-2.5" />}
                                {st === "resolved" && <CheckCircle2 className="h-2.5 w-2.5" />}
                                {cfg.label}
                              </button>
                            )
                          })()}
                          {name && <span className="text-[13px] font-medium">{name}</span>}
                          {email && !name && (
                            <span className="text-[13px] font-medium">{email}</span>
                          )}
                          {email && name && (
                            <span className="text-[12px] text-muted-foreground">{email}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                            {new Date(sub.submissionTime).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>

                        {/* First text answer as preview */}
                        {textQ && (
                          <p className="text-[13px] text-muted-foreground line-clamp-2">{String(textQ.value)}</p>
                        )}

                        {/* Key answers preview */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {sub.questions.slice(0, 5).map((q) => {
                            if (!q.value || q.type === "OpinionScale" || /pr[ée]nom|nom|e-?mail/i.test(q.name)) return null
                            if (q.type === "LongAnswer" || q.type === "ShortAnswer") return null
                            const val = Array.isArray(q.value) ? q.value.join(", ") : String(q.value)
                            return (
                              <span key={q.id} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground truncate max-w-40">
                                {val}
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {rating !== null && rating <= 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const textQ = sub.questions.find((q) => (q.type === "ShortAnswer" || q.type === "LongAnswer") && q.value && !/pr[ée]nom|nom|e-?mail/i.test(q.name))
                              setEmailDialog({
                                open: true,
                                customerName: name || null,
                                customerEmail: email,
                                rating,
                                feedback: textQ ? String(textQ.value) : null,
                                submissionDate: sub.submissionTime,
                              })
                            }}
                            className="p-1.5 rounded-md text-white bg-gdl-purple hover:bg-[#005FCC] transition-colors"
                            title="Générer email IA"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {email && (
                          <>
                            <a
                              href={`mailto:${email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-gdl-purple hover:bg-[#EAF3FF] transition-colors"
                              title="Envoyer email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={`https://admin.shopify.com/store/grainedelascars/customers?query=${encodeURIComponent(email)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Voir sur Shopify"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      <SubmissionDetailPanel
        submission={selectedSubmission}
        open={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        onGenerateEmail={(sub) => {
          const nameQ = sub.questions.find((q) => q.type === "ShortAnswer" && /pr[ée]nom/i.test(q.name))
          const textQ = sub.questions.find((q) => (q.type === "ShortAnswer" || q.type === "LongAnswer") && q.value && !/pr[ée]nom|nom|e-?mail/i.test(q.name))
          setEmailDialog({
            open: true,
            customerName: nameQ?.value ? String(nameQ.value) : null,
            customerEmail: getEmail(sub),
            rating: getRating(sub) ?? 1,
            feedback: textQ ? String(textQ.value) : null,
            submissionDate: sub.submissionTime,
          })
        }}
      />

      {/* AI Email Dialog */}
      <GenerateEmailDialog
        open={emailDialog.open}
        onClose={() => setEmailDialog((prev) => ({ ...prev, open: false }))}
        customerName={emailDialog.customerName}
        customerEmail={emailDialog.customerEmail}
        rating={emailDialog.rating}
        feedback={emailDialog.feedback}
        formName={formMeta?.name || ""}
        submissionDate={emailDialog.submissionDate}
      />
    </div>
  )
}

// ─── KPI Card ───

function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="rounded-md p-2 w-fit mb-3" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
      <p className="text-[13px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

// ─── Submission detail side panel ───

function SubmissionDetailPanel({ submission, open, onClose, onGenerateEmail }: { submission: FilloutSubmission | null; open: boolean; onClose: () => void; onGenerateEmail: (sub: FilloutSubmission) => void }) {
  if (!submission) return null

  const email = getEmail(submission)
  const rating = getRating(submission)

  function copyAll() {
    const text = submission!.questions
      .map((q) => {
        const val = q.value
        const display = Array.isArray(val) ? val.join(", ") : String(val ?? "—")
        return `${q.name}: ${display}`
      })
      .join("\n")
    navigator.clipboard.writeText(text)
    toast.success("Réponses copiées")
  }

  const nameQ = submission.questions.find((q) => q.type === "ShortAnswer" && /pr[ée]nom/i.test(q.name))
  const lastNameQ = submission.questions.find((q) => q.type === "ShortAnswer" && /nom/i.test(q.name) && !/pr[ée]nom/i.test(q.name))
  const displayName = [nameQ?.value, lastNameQ?.value].filter(Boolean).join(" ") || (email || "Réponse")

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] flex items-center justify-center">
              <User className="h-4 w-4 text-gdl-purple" />
            </div>
            {displayName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Date + Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(submission.submissionTime).toLocaleString("fr-FR", {
                day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </div>
            {rating !== null && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-semibold",
                rating >= 4 ? "bg-[#CDFED4] text-[#047B5D]" : rating >= 3 ? "bg-[#FFF1E3] text-[#8A6116]" : "bg-[#FEE8EB] text-[#C70A24]"
              )}>
                <Star className="h-3 w-3 fill-current" /> {rating}/5
              </div>
            )}
          </div>

          {/* Email + Quick actions */}
          {email && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[13px]">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{email}</span>
              </div>
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-[#EAF3FF] text-gdl-purple hover:bg-gdl-purple hover:text-white transition-colors"
              >
                <Mail className="h-3 w-3" /> Email
              </a>
              <a
                href={`https://admin.shopify.com/store/grainedelascars/customers?query=${encodeURIComponent(email)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Shopify
              </a>
            </div>
          )}

          {/* AI Email button — show for critical ratings */}
          {rating !== null && rating <= 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGenerateEmail(submission!)}
              className="w-full gap-2 h-9 text-[13px] border-gdl-purple text-gdl-purple hover:bg-gdl-purple hover:text-white"
            >
              <Sparkles className="h-4 w-4" />
              Générer un email de suivi (IA)
            </Button>
          )}

          <Separator />

          <div className="space-y-4">
            {submission.questions.map((q) => {
              const val = q.value
              let display: string
              if (val === null || val === undefined) display = "—"
              else if (Array.isArray(val)) display = val.join(", ")
              else if (typeof val === "boolean") display = val ? "Oui" : "Non"
              else display = String(val)

              const isRating = q.type === "OpinionScale"

              return (
                <div key={q.id}>
                  <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{q.name}</p>
                  {isRating && typeof val === "number" ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn("h-4 w-4", n <= val ? "fill-[#E67C00] text-[#E67C00]" : "text-border")} />
                      ))}
                      <span className="text-sm ml-1 text-muted-foreground">({val}/5)</span>
                    </div>
                  ) : (
                    <p className="text-sm">{display}</p>
                  )}
                </div>
              )
            })}
          </div>

          <Separator />

          <Button variant="outline" className="w-full gap-2 h-9 text-[13px]" onClick={copyAll}>
            <Copy className="h-4 w-4" />
            Copier toutes les réponses
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
