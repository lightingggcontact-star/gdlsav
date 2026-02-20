"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  Eye,
  MousePointer,
  Navigation,
  PhoneCall,
  RefreshCw,
  Send,
  ExternalLink,
  AlertCircle,
  Search,
  Map,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// ─── Types (miroir de lib/gbp.ts) ──────────────────────

interface BusinessInfo {
  name: string
  title: string
  address: string
  phone: string
  website: string
  category: string
  mapsUrl: string
  averageRating: number
  totalReviews: number
  regularHours: { day: string; openTime: string; closeTime: string }[]
}

interface Review {
  reviewId: string
  name: string
  reviewer: { displayName: string; profilePhotoUrl: string | null }
  starRating: string
  comment: string | null
  createTime: string
  updateTime: string
  reviewReply: { comment: string; updateTime: string } | null
}

interface ReviewsSummary {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
}

interface PerformanceStats {
  period: { start: string; end: string }
  searchViews: number
  mapsViews: number
  websiteClicks: number
  directionRequests: number
  phoneCallClicks: number
  totalViews: number
  dailyBreakdown: {
    date: string
    searchViews: number
    mapsViews: number
    websiteClicks: number
    directionRequests: number
    phoneCallClicks: number
  }[]
}

// ─── Helpers ────────────────────────────────────────────

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

const DAY_NAMES: Record<string, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
}

function starNum(rating: string): number {
  return STAR_MAP[rating] ?? 0
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return "Hier"
  if (diffDays < 30) return `Il y a ${diffDays} jours`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`
  const diffYears = Math.floor(diffDays / 365)
  return `Il y a ${diffYears} an${diffYears > 1 ? "s" : ""}`
}

// ─── Composants internes ────────────────────────────────

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            cls,
            i <= rating ? "text-[#E67C00] fill-[#E67C00]" : "text-border"
          )}
        />
      ))}
    </div>
  )
}

function RatingBar({
  star,
  count,
  total,
}: {
  star: number
  count: number
  total: number
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] w-5 text-right font-medium">{star}★</span>
      <div className="flex-1 h-2 rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-[#E67C00] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-muted-foreground w-8 text-right">
        {count}
      </span>
    </div>
  )
}

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
      {sub && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      )}
    </div>
  )
}

// ─── Page principale ────────────────────────────────────

export default function GoogleFichesPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Données
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewsSummary | null>(null)
  const [performance, setPerformance] = useState<PerformanceStats | null>(null)

  // Filtres avis
  const [reviewFilter, setReviewFilter] = useState<string>("all")

  // Réponse aux avis
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replySending, setReplySending] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [accountRes, reviewsRes, perfRes] = await Promise.all([
        fetch("/api/gbp/account"),
        fetch("/api/gbp/reviews"),
        fetch("/api/gbp/performance"),
      ])

      if (accountRes.ok) {
        const data = await accountRes.json()
        setBusinessInfo(data.businessInfo)
      } else {
        const data = await accountRes.json().catch(() => null)
        setError(data?.error ?? `Erreur ${accountRes.status}`)
      }

      if (reviewsRes.ok) {
        const data = await reviewsRes.json()
        setReviews(data.reviews ?? [])
        setSummary(data.summary ?? null)
        // Enrichir businessInfo avec les stats des avis
        if (data.summary) {
          setBusinessInfo((prev) =>
            prev
              ? {
                  ...prev,
                  averageRating: data.summary.averageRating,
                  totalReviews: data.summary.totalReviews,
                }
              : prev
          )
        }
      }

      if (perfRes.ok) {
        const data = await perfRes.json()
        setPerformance(data)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de connexion"
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
  }

  async function handleReply(reviewName: string, reviewId: string) {
    if (!replyText.trim()) return
    setReplySending(true)
    try {
      const res = await fetch(`/api/gbp/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewName, responseText: replyText.trim() }),
      })

      if (res.ok) {
        toast.success("Réponse publiée avec succès")
        setReplyingTo(null)
        setReplyText("")
        // Rafraîchir les avis
        const reviewsRes = await fetch("/api/gbp/reviews")
        if (reviewsRes.ok) {
          const data = await reviewsRes.json()
          setReviews(data.reviews ?? [])
          setSummary(data.summary ?? null)
        }
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "Erreur lors de la réponse")
      }
    } catch {
      toast.error("Erreur de connexion")
    } finally {
      setReplySending(false)
    }
  }

  // Filtrage des avis
  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === "all") return true
    if (reviewFilter === "unanswered") return !r.reviewReply
    const num = parseInt(reviewFilter)
    return starNum(r.starRating) === num
  })

  const unansweredCount = reviews.filter((r) => !r.reviewReply).length

  // ─── Loading state ────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
          <Skeleton className="h-9 w-28" />
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

  // ─── Error state (OAuth pas configuré) ────────────────
  if (error && !businessInfo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Google Fiches</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Fiche Google Business Profile
          </p>
        </div>
        <div className="rounded-lg border border-[#E67C00] bg-[#FFF1E3] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#E67C00] shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-[#E67C00]">
                Configuration OAuth requise
              </p>
              <p className="text-[13px] text-[#E67C00]/80 mt-1">{error}</p>
              <p className="text-[12px] text-[#E67C00]/60 mt-2">
                1. Va sur{" "}
                <code className="bg-[#E67C00]/10 px-1 rounded">
                  http://localhost:3000/api/gbp/callback
                </code>{" "}
                pour obtenir le lien d'autorisation
                <br />
                2. Autorise l'accès avec ton compte Google
                <br />
                3. Copie le refresh_token dans{" "}
                <code className="bg-[#E67C00]/10 px-1 rounded">
                  .env.local
                </code>{" "}
                (variable GOOGLE_REFRESH_TOKEN)
                <br />
                4. Redémarre le serveur
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Rendu principal ──────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Google Fiches</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Fiche Google Business Profile — {businessInfo?.title ?? "Graine de Lascars"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
          Rafraîchir
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            Avis
            {unansweredCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E67C00] text-white text-[10px] font-semibold flex items-center justify-center">
                {unansweredCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* ─── Tab : Vue d'ensemble ─── */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Star}
              label="Note moyenne"
              value={
                summary
                  ? `${summary.averageRating}/5`
                  : "—"
              }
              sub={
                summary
                  ? `Sur ${summary.totalReviews} avis`
                  : undefined
              }
              color="#E67C00"
            />
            <KpiCard
              icon={Eye}
              label="Vues totales (30j)"
              value={
                performance
                  ? performance.totalViews.toLocaleString("fr-FR")
                  : "—"
              }
              sub="Recherche + Maps"
              color="#007AFF"
            />
            <KpiCard
              icon={MousePointer}
              label="Clics site web (30j)"
              value={
                performance
                  ? performance.websiteClicks.toLocaleString("fr-FR")
                  : "—"
              }
              color="#047B5D"
            />
            <KpiCard
              icon={PhoneCall}
              label="Appels (30j)"
              value={
                performance
                  ? performance.phoneCallClicks.toLocaleString("fr-FR")
                  : "—"
              }
              color="#8B5CF6"
            />
          </div>

          {/* Business Info Card */}
          {businessInfo && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-semibold">
                  Informations de la fiche
                </h2>
                {businessInfo.mapsUrl && (
                  <a
                    href={businessInfo.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[#007AFF] hover:underline flex items-center gap-1"
                  >
                    Voir sur Google Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {businessInfo.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-[13px]">{businessInfo.address}</span>
                    </div>
                  )}
                  {businessInfo.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-[13px]">{businessInfo.phone}</span>
                    </div>
                  )}
                  {businessInfo.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={businessInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#007AFF] hover:underline"
                      >
                        {businessInfo.website}
                      </a>
                    </div>
                  )}
                  {businessInfo.category && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[11px]">
                        {businessInfo.category}
                      </Badge>
                    </div>
                  )}
                </div>
                {businessInfo.regularHours.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[12px] font-medium text-muted-foreground">
                        Horaires
                      </span>
                    </div>
                    <div className="space-y-1">
                      {businessInfo.regularHours.map((h) => (
                        <div
                          key={h.day}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <span className="text-muted-foreground">
                            {DAY_NAMES[h.day] ?? h.day}
                          </span>
                          <span>
                            {h.openTime} — {h.closeTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Distribution des notes */}
          {summary && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
              <h2 className="text-[13px] font-semibold mb-3">
                Répartition des notes
              </h2>
              <div className="space-y-2 max-w-md">
                {[5, 4, 3, 2, 1].map((s) => (
                  <RatingBar
                    key={s}
                    star={s}
                    count={summary.ratingDistribution[s] ?? 0}
                    total={summary.totalReviews}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Alerte avis sans réponse */}
          {unansweredCount > 0 && (
            <div className="rounded-lg border border-[#E67C00] bg-[#FFF1E3] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#E67C00]" />
                <span className="text-[13px] font-medium text-[#E67C00]">
                  {unansweredCount} avis sans réponse
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[#E67C00] border-[#E67C00] hover:bg-[#E67C00]/10"
                onClick={() => {
                  const tabsEl = document.querySelector('[data-value="reviews"]') as HTMLElement
                  tabsEl?.click()
                  setReviewFilter("unanswered")
                }}
              >
                Voir les avis
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ─── Tab : Avis ─── */}
        <TabsContent value="reviews" className="space-y-4">
          {/* Summary bar */}
          {summary && (
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {summary.totalReviews} avis
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-[#E67C00] fill-[#E67C00]" />
                {summary.averageRating}
              </span>
              <span>·</span>
              <span className="text-[#E67C00] font-medium">
                {unansweredCount} sans réponse
              </span>
            </div>
          )}

          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "all", label: "Tous" },
              { key: "unanswered", label: "Sans réponse" },
              { key: "5", label: "5★" },
              { key: "4", label: "4★" },
              { key: "3", label: "3★" },
              { key: "2", label: "2★" },
              { key: "1", label: "1★" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setReviewFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors",
                  reviewFilter === f.key
                    ? "bg-[#007AFF] text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Liste des avis */}
          <div className="space-y-3">
            {filteredReviews.length === 0 && (
              <div className="text-center py-12 text-[13px] text-muted-foreground">
                Aucun avis trouvé pour ce filtre.
              </div>
            )}
            {filteredReviews.map((review) => (
              <div
                key={review.reviewId}
                className={cn(
                  "rounded-lg border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]",
                  !review.reviewReply
                    ? "border-[#E67C00]/30"
                    : "border-border"
                )}
              >
                {/* Header avis */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                      {review.reviewer.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">
                        {review.reviewer.displayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {timeAgo(review.createTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={starNum(review.starRating)} />
                    {!review.reviewReply && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-[#FFF1E3] text-[#E67C00] border-[#E67C00]/20"
                      >
                        Sans réponse
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Texte de l'avis */}
                {review.comment && (
                  <p className="text-[13px] text-foreground/90 mb-3 leading-relaxed">
                    {review.comment}
                  </p>
                )}

                {/* Réponse existante */}
                {review.reviewReply && (
                  <div className="ml-4 pl-3 border-l-2 border-[#007AFF]/30 mt-2">
                    <p className="text-[11px] font-medium text-[#007AFF] mb-1">
                      Réponse du propriétaire
                    </p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      {review.reviewReply.comment}
                    </p>
                  </div>
                )}

                {/* Bouton / Formulaire de réponse */}
                {!review.reviewReply && (
                  <div className="mt-3">
                    {replyingTo === review.reviewId ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Votre réponse..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="text-[13px] min-h-[80px]"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleReply(review.name, review.reviewId)
                            }
                            disabled={replySending || !replyText.trim()}
                            className="gap-1.5 bg-[#007AFF] hover:bg-[#0066DD]"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {replySending ? "Envoi..." : "Publier"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null)
                              setReplyText("")
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[12px] gap-1.5"
                        onClick={() => {
                          setReplyingTo(review.reviewId)
                          setReplyText("")
                        }}
                      >
                        <Send className="h-3 w-3" />
                        Répondre
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── Tab : Performance ─── */}
        <TabsContent value="performance" className="space-y-4">
          {performance ? (
            <>
              {/* Période */}
              <p className="text-[12px] text-muted-foreground">
                Période : {performance.period.start} → {performance.period.end}
              </p>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard
                  icon={Search}
                  label="Recherche Google"
                  value={performance.searchViews.toLocaleString("fr-FR")}
                  color="#007AFF"
                />
                <KpiCard
                  icon={Map}
                  label="Google Maps"
                  value={performance.mapsViews.toLocaleString("fr-FR")}
                  color="#047B5D"
                />
                <KpiCard
                  icon={MousePointer}
                  label="Clics site web"
                  value={performance.websiteClicks.toLocaleString("fr-FR")}
                  color="#8B5CF6"
                />
                <KpiCard
                  icon={Navigation}
                  label="Itinéraires"
                  value={performance.directionRequests.toLocaleString("fr-FR")}
                  color="#E67C00"
                />
                <KpiCard
                  icon={PhoneCall}
                  label="Appels"
                  value={performance.phoneCallClicks.toLocaleString("fr-FR")}
                  color="#C70A24"
                />
              </div>

              {/* Graphique quotidien */}
              {performance.dailyBreakdown.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                  <h2 className="text-[13px] font-semibold mb-4">
                    Vues quotidiennes (30 jours)
                  </h2>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={performance.dailyBreakdown}
                        margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                      >
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: string) => v.slice(5)}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          iconSize={8}
                        />
                        <Bar
                          dataKey="searchViews"
                          name="Recherche"
                          fill="#007AFF"
                          stackId="views"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="mapsViews"
                          name="Maps"
                          fill="#047B5D"
                          stackId="views"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Graphique actions */}
              {performance.dailyBreakdown.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
                  <h2 className="text-[13px] font-semibold mb-4">
                    Actions quotidiennes (30 jours)
                  </h2>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={performance.dailyBreakdown}
                        margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                      >
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: string) => v.slice(5)}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          iconSize={8}
                        />
                        <Bar
                          dataKey="websiteClicks"
                          name="Site web"
                          fill="#8B5CF6"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          dataKey="directionRequests"
                          name="Itinéraires"
                          fill="#E67C00"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          dataKey="phoneCallClicks"
                          name="Appels"
                          fill="#C70A24"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-[13px] text-muted-foreground">
              Aucune donnée de performance disponible.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
