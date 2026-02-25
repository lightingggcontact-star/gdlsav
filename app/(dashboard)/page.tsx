"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Package,
  Clock,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Mail,
  MessageSquare,
  Loader2,
  ArrowRight,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { SavTrendsChart } from "@/components/sav-trends-chart"
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

interface GorgiasTicket {
  id: number | string
  status: string
  created_datetime: string
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

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—"
  if (minutes < 60) return `${Math.round(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
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
    case "custom": {
      return {
        from: customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 86400000),
        to: customTo ? new Date(customTo + "T23:59:59") : to,
      }
    }
  }
}

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

      const { data: cached, error } = await supabaseAnalysis
        .from("ticket_cache")
        .select("*")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(25)

      if (error || !cached || cached.length === 0) {
        setRecap(cached?.length === 0
          ? "Aucun ticket sur cette période. Cliquez 'Sync' pour synchroniser les emails."
          : "Erreur de lecture. Lancez une sync d'abord.")
        setAnalyzing(false)
        return
      }

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
          <Mail className="h-4 w-4 text-[#007AFF]" />
          Analyse Messages
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2 text-xs h-7">
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Sync..." : "Sync tickets"}
          </Button>
          <Button
            variant="outline" size="sm" onClick={handleLearn} disabled={learning || syncing}
            className="gap-2 text-xs h-7 border-[#007AFF] text-[#007AFF] hover:bg-[#007AFF] hover:text-white"
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
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex gap-1.5">
            {(Object.keys(PERIOD_LABELS) as AnalysisPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                  period === p ? "bg-[#007AFF] text-white" : "bg-[#F5F5F5] text-muted-foreground hover:bg-[#E9E9EB]"
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 px-2 text-[12px] border border-border rounded-md bg-background" />
              <span className="text-xs text-muted-foreground">&rarr;</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 px-2 text-[12px] border border-border rounded-md bg-background" />
            </div>
          )}

          <Button onClick={handleAnalyze} disabled={analyzing} size="sm" className="bg-[#007AFF] text-white hover:bg-[#007AFF]/90 gap-2 h-8">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analyzing ? "Analyse en cours..." : "Analyser"}
          </Button>
        </div>

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
            <div className="w-10 h-10 rounded-full bg-[#EAF3FF] flex items-center justify-center mb-3">
              <Mail className="h-5 w-5 text-[#007AFF]" />
            </div>
            <p className="text-sm font-medium">Analyse des tickets</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cliquez &quot;Sync tickets&quot; puis sélectionnez une période et cliquez Analyser
            </p>
            {lastSync && (
              <p className="text-[10px] text-muted-foreground/60 mt-2">Dernière sync : {lastSync}</p>
            )}
            {learnResult && (
              <p className="text-[10px] text-[#007AFF] mt-1">{learnResult}</p>
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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Ticket KPIs
  const [ticketKpis, setTicketKpis] = useState<{
    openCount: number; unreadCount: number; todayCount: number; weekCount: number
  } | null>(null)
  const [avgResponseTime, setAvgResponseTime] = useState<number | null>(null)

  // AI summary
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

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

    const res = await withTimeout(fetch(`/api/shipping?thresholdFR=${thresholdFR}&thresholdBE=${thresholdBE}`), 15000)
    if (res.ok) setShippingData(await res.json())
  }, [supabase])

  const fetchTicketKpis = useCallback(async () => {
    try {
      // Fetch tickets from Gorgias
      const res = await fetch("/api/gorgias/tickets")
      if (!res.ok) return
      const data = await res.json()
      const tickets: GorgiasTicket[] = data.data || data.tickets || data || []

      const openTickets = tickets.filter(t => t.status === "open")
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - diff)
      startOfWeek.setHours(0, 0, 0, 0)

      const todayCount = openTickets.filter(t => new Date(t.created_datetime) >= startOfDay).length
      const weekCount = openTickets.filter(t => new Date(t.created_datetime) >= startOfWeek).length

      // Get unread count from Supabase
      const { data: { user } } = await supabase.auth.getUser()
      let unreadCount = openTickets.length
      if (user) {
        const { data: readRows } = await supabase
          .from("ticket_read_status")
          .select("ticket_id")
          .eq("user_id", user.id)
        if (readRows) {
          const readSet = new Set(readRows.map((r: { ticket_id: string }) => String(r.ticket_id)))
          unreadCount = openTickets.filter(t => !readSet.has(String(t.id))).length
        }
      }

      setTicketKpis({ openCount: openTickets.length, unreadCount, todayCount, weekCount })
    } catch { /* silent */ }
  }, [supabase])

  const fetchResponseTime = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/response-time?period=week")
      if (res.ok) {
        const data = await res.json()
        setAvgResponseTime(data.avgMinutes)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setLoading(true)

    // Load cached AI summary
    try {
      const cached = localStorage.getItem("gdl-ai-summary")
      if (cached) {
        const { summary, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setAiSummary(summary)
        }
      }
    } catch { /* ignore */ }

    Promise.all([
      fetchShipping(),
      fetchTicketKpis(),
      fetchResponseTime(),
    ]).finally(() => setLoading(false))
  }, [fetchShipping, fetchTicketKpis, fetchResponseTime])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchShipping(), fetchTicketKpis(), fetchResponseTime()])
    setRefreshing(false)
  }

  async function handleWeeklySummary() {
    setSummaryLoading(true)
    try {
      // Use ticket_cache data for the summary instead of reviews
      const { data: cachedTickets } = await supabase
        .from("ticket_cache")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)

      const ticketsForSummary = (cachedTickets || []).map((t: any) => ({
        rating: 3, // No rating for tickets, use neutral
        feedback: t.first_message || t.subject || "",
        formName: "Gorgias",
        submissionDate: t.created_at,
        category: t.subject?.toLowerCase().includes("livraison") ? "livraison" : "autre",
      }))

      const res = await fetch("/api/ai/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews: ticketsForSummary,
          totalReviews: ticketsForSummary.length,
          avgRating: null,
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

  const chartData = [
    { name: "Retards", value: stats.delayed, fill: "#C70A24" },
    { name: "En transit", value: stats.inTransit, fill: "#E67C00" },
    { name: "Livrés", value: stats.delivered, fill: "#047B5D" },
  ]

  // ─── Render ───

  if (loading) {
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
            Graine de Lascars &mdash; Vue d&apos;ensemble
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Rafraîchir
        </Button>
      </div>

      {/* KPI Cards — 80% messages, 20% shipping */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Tickets ouverts"
          value={ticketKpis?.openCount ?? "..."}
          subtitle={`${ticketKpis?.todayCount ?? 0} aujourd'hui · ${ticketKpis?.weekCount ?? 0} cette semaine`}
          icon={MessageSquare}
          color="#007AFF"
          href="/messages"
        />
        <KpiCard
          label="Non lus"
          value={ticketKpis?.unreadCount ?? "..."}
          subtitle="Tickets à traiter"
          icon={Mail}
          color="#C70A24"
          href="/messages"
        />
        <KpiCard
          label="Temps de réponse"
          value={avgResponseTime != null ? formatDuration(avgResponseTime) : "..."}
          subtitle="Moyenne cette semaine"
          icon={Clock}
          color="#047B5D"
        />
        <KpiCard
          label="Retards livraison"
          value={stats.delayed}
          subtitle={`${stats.total} commandes suivies`}
          icon={Package}
          color="#E67C00"
          href="/shipping"
        />
      </div>

      {/* Two-column: SAV Trends + Shipping overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SAV Trends Chart */}
        <SavTrendsChart />

        {/* Shipping overview */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#C70A24]" />
              Livraisons en retard
            </h2>
            {delayedOrders.length > 0 && (
              <Link href="/shipping" className="text-xs text-[#007AFF] hover:underline flex items-center gap-1">
                Voir tout <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {stats.total > 0 ? (
            <div className="space-y-4">
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
                          target="_blank" rel="noopener noreferrer"
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

      {/* AI Weekly Summary */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#007AFF]" />
            Résumé IA
          </h2>
          <Button variant="outline" size="sm" onClick={handleWeeklySummary} disabled={summaryLoading} className="gap-1.5 h-7 text-[11px]">
            {summaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {aiSummary ? "Actualiser" : "Générer"}
          </Button>
        </div>
        {summaryLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
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
            <div className="w-10 h-10 rounded-full bg-[#EAF3FF] flex items-center justify-center mb-3">
              <Sparkles className="h-5 w-5 text-[#007AFF]" />
            </div>
            <p className="text-sm font-medium">Résumé IA hebdomadaire</p>
            <p className="text-xs text-muted-foreground mt-1">
              Claude analysera vos tickets et identifiera les tendances
            </p>
          </div>
        )}
      </div>

      {/* Ticket Analysis Section */}
      <TicketAnalysisSection />
    </div>
  )
}
