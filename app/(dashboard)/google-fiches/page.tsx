"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ─── Types (miroir de lib/gbp.ts — Places API) ─────

interface BusinessInfo {
  placeId: string
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
  rating: number
  comment: string | null
  createTime: string
  relativeTime: string
}

interface ReviewsSummary {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
}

// ─── Helpers ────────────────────────────────────────

const DAY_NAMES: Record<string, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ""
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

// ─── Composants internes ────────────────────────────

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

// ─── Page principale ────────────────────────────────

export default function GoogleFichesPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Données
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewsSummary | null>(null)

  // Filtres avis
  const [reviewFilter, setReviewFilter] = useState<string>("all")

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [accountRes, reviewsRes] = await Promise.all([
        fetch("/api/gbp/account"),
        fetch("/api/gbp/reviews"),
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
        // Enrichir businessInfo avec les stats globales
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

  // Filtrage des avis
  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === "all") return true
    const num = parseInt(reviewFilter)
    return r.rating === num
  })

  // ─── Loading state ────────────────────────────────
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

  // ─── Error state ──────────────────────────────────
  if (error && !businessInfo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Google Fiches</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Fiche Google Business Profile
          </p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-destructive">
                Erreur de connexion
              </p>
              <p className="text-[13px] text-destructive/80 mt-1">{error}</p>
              <p className="text-[12px] text-muted-foreground mt-2">
                Vérifiez que la variable <code className="bg-muted px-1 rounded">GOOGLE_API_KEY</code> est bien
                configurée dans les variables d'environnement.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Rendu principal ──────────────────────────────
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
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            Avis
            {summary && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E67C00] text-white text-[10px] font-semibold flex items-center justify-center">
                {summary.totalReviews}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab : Vue d'ensemble ─── */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              icon={Star}
              label="Note moyenne"
              value={
                summary
                  ? `${summary.averageRating}/5`
                  : businessInfo
                    ? `${businessInfo.averageRating}/5`
                    : "—"
              }
              sub={
                summary
                  ? `Sur ${summary.totalReviews} avis Google`
                  : businessInfo
                    ? `Sur ${businessInfo.totalReviews} avis Google`
                    : undefined
              }
              color="#E67C00"
            />
            <KpiCard
              icon={MapPin}
              label="Catégorie"
              value={businessInfo?.category || "—"}
              sub="Type d'activité"
              color="#007AFF"
            />
            <KpiCard
              icon={Globe}
              label="Site web"
              value={businessInfo?.website ? "Actif" : "—"}
              sub={businessInfo?.website || undefined}
              color="#047B5D"
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
                      {businessInfo.regularHours.map((h, idx) => (
                        <div
                          key={`${h.day}-${idx}`}
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
              <h2 className="text-[13px] font-semibold mb-1">
                Répartition des notes
              </h2>
              <p className="text-[11px] text-muted-foreground mb-3">
                Basée sur les {reviews.length} avis les plus pertinents
              </p>
              <div className="space-y-2 max-w-md">
                {[5, 4, 3, 2, 1].map((s) => (
                  <RatingBar
                    key={s}
                    star={s}
                    count={summary.ratingDistribution[s] ?? 0}
                    total={reviews.length}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Tab : Avis ─── */}
        <TabsContent value="reviews" className="space-y-4">
          {/* Summary bar */}
          {summary && (
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {summary.totalReviews} avis au total
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-[#E67C00] fill-[#E67C00]" />
                {summary.averageRating}
              </span>
              <span>·</span>
              <span className="text-muted-foreground">
                {reviews.length} avis affichés (les plus pertinents)
              </span>
            </div>
          )}

          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "all", label: "Tous" },
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
                className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]"
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
                        {review.relativeTime || timeAgo(review.createTime)}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>

                {/* Texte de l'avis */}
                {review.comment && (
                  <p className="text-[13px] text-foreground/90 leading-relaxed">
                    {review.comment}
                  </p>
                )}

                {/* Pas de commentaire */}
                {!review.comment && (
                  <p className="text-[12px] text-muted-foreground italic">
                    Avis sans commentaire
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Note de limitation */}
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
            <p className="text-[11px] text-muted-foreground">
              L&apos;API Google Places affiche les 5 avis les plus pertinents.
              Pour voir tous les avis, consultez votre{" "}
              <a
                href={businessInfo?.mapsUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#007AFF] hover:underline"
              >
                fiche Google Maps
              </a>
              .
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
