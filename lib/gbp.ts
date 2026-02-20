// lib/gbp.ts
// Service Google Business Profile — authentification OAuth 2.0 et appels API GBP
// Fiche cible : "Graine de Lascars"

import { google } from "googleapis"

// ─── Types ───────────────────────────────────────────────

export interface GBPBusinessInfo {
  name: string               // Resource name complet
  title: string              // Nom affiché ("Graine de Lascars")
  address: string            // Adresse formatée
  phone: string
  website: string
  category: string           // Catégorie principale
  mapsUrl: string            // Lien Google Maps
  averageRating: number
  totalReviews: number
  regularHours: {
    day: string              // "MONDAY", etc.
    openTime: string         // "09:00"
    closeTime: string        // "19:00"
  }[]
}

export interface GBPReview {
  reviewId: string
  name: string               // Resource name complet
  reviewer: {
    displayName: string
    profilePhotoUrl: string | null
  }
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"
  comment: string | null
  createTime: string
  updateTime: string
  reviewReply: {
    comment: string
    updateTime: string
  } | null
}

export interface GBPReviewsSummary {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
}

export interface GBPPerformanceStats {
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

// ─── Configuration OAuth 2.0 ────────────────────────────

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Variables manquantes : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REFRESH_TOKEN requis dans .env.local"
    )
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

/** Obtient un access token frais (le SDK gère le cache interne) */
async function getAccessToken(): Promise<string> {
  const client = getOAuth2Client()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error("Impossible d'obtenir un access token Google")
  return token
}

// ─── Cache serveur pour accountId / locationId ──────────

let cachedAccountId: string | null = null
let cachedLocationId: string | null = null
let cachedLocationName: string | null = null

// Mapping étoiles texte → nombre
const STAR_TO_NUM: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

// ─── Fonctions API ──────────────────────────────────────

/** Récupère l'account ID du compte GBP */
export async function getAccountId(): Promise<string> {
  if (cachedAccountId) return cachedAccountId

  const token = await getAccessToken()
  const res = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GBP Accounts API ${res.status}: ${text}`)
  }

  const data = await res.json()
  const accounts = data.accounts || []
  if (accounts.length === 0) {
    throw new Error("Aucun compte Google Business Profile trouvé")
  }

  // Prendre le premier compte
  cachedAccountId = accounts[0].name.replace("accounts/", "")
  return cachedAccountId!
}

/** Récupère le locationId pour "Graine de Lascars" */
export async function getLocationId(): Promise<{
  accountId: string
  locationId: string
  locationName: string
}> {
  if (cachedAccountId && cachedLocationId && cachedLocationName) {
    return {
      accountId: cachedAccountId,
      locationId: cachedLocationId,
      locationName: cachedLocationName,
    }
  }

  const accountId = await getAccountId()
  const token = await getAccessToken()

  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,metadata`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GBP Locations API ${res.status}: ${text}`)
  }

  const data = await res.json()
  const locations = data.locations || []

  // Chercher "Graine de Lascars" par nom
  const target =
    locations.find(
      (loc: { title?: string }) =>
        loc.title?.toLowerCase().includes("graine de lascars")
    ) || locations[0]

  if (!target) {
    throw new Error("Aucune fiche trouvée pour 'Graine de Lascars'")
  }

  // Le name peut être "locations/xxx" ou "accounts/xxx/locations/xxx"
  const nameParts = (target.name as string).split("/")
  cachedLocationId = nameParts[nameParts.length - 1]
  cachedLocationName = target.name
  cachedAccountId = accountId

  return {
    accountId,
    locationId: cachedLocationId!,
    locationName: cachedLocationName!,
  }
}

/** Récupère les informations complètes de la fiche */
export async function getBusinessInfo(): Promise<GBPBusinessInfo> {
  const { locationName } = await getLocationId()
  const token = await getAccessToken()

  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,metadata`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GBP Location Info API ${res.status}: ${text}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const loc: any = await res.json()

  const address = loc.storefrontAddress
    ? [
        loc.storefrontAddress.addressLines?.join(", "),
        loc.storefrontAddress.locality,
        loc.storefrontAddress.postalCode,
        loc.storefrontAddress.regionCode,
      ]
        .filter(Boolean)
        .join(", ")
    : ""

  return {
    name: loc.name ?? "",
    title: loc.title ?? "",
    address,
    phone: loc.phoneNumbers?.primaryPhone ?? "",
    website: loc.websiteUri ?? "",
    category: loc.categories?.primaryCategory?.displayName ?? "",
    mapsUrl: loc.metadata?.mapsUri ?? "",
    averageRating: 0,
    totalReviews: 0,
    regularHours: (loc.regularHours?.periods || []).map((p: any) => ({
      day: p.openDay,
      openTime: `${String(p.openTime?.hours ?? 0).padStart(2, "0")}:${String(p.openTime?.minutes ?? 0).padStart(2, "0")}`,
      closeTime: `${String(p.closeTime?.hours ?? 0).padStart(2, "0")}:${String(p.closeTime?.minutes ?? 0).padStart(2, "0")}`,
    })),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Récupère TOUS les avis avec pagination complète */
export async function getAllReviews(): Promise<{
  reviews: GBPReview[]
  summary: GBPReviewsSummary
}> {
  const { accountId, locationId } = await getLocationId()
  const token = await getAccessToken()

  const allReviews: GBPReview[] = []
  let pageToken: string | null = null

  // Boucle de pagination — on récupère TOUS les avis
  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
    )
    url.searchParams.set("pageSize", "50")
    if (pageToken) url.searchParams.set("pageToken", pageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GBP Reviews API ${res.status}: ${text}`)
    }

    const data = await res.json()
    const reviews = (data.reviews || []).map((r: any) => ({
      reviewId: (r.name as string).split("/").pop() ?? "",
      name: r.name,
      reviewer: {
        displayName: r.reviewer?.displayName ?? "Anonyme",
        profilePhotoUrl: r.reviewer?.profilePhotoUrl ?? null,
      },
      starRating: r.starRating ?? "FIVE",
      comment: r.comment ?? null,
      createTime: r.createTime ?? "",
      updateTime: r.updateTime ?? "",
      reviewReply: r.reviewReply
        ? {
            comment: r.reviewReply.comment ?? "",
            updateTime: r.reviewReply.updateTime ?? "",
          }
        : null,
    }))
    allReviews.push(...reviews)
    pageToken = data.nextPageToken || null
  } while (pageToken)

  // Calcul du résumé
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let totalStars = 0

  for (const review of allReviews) {
    const num = STAR_TO_NUM[review.starRating] ?? 0
    distribution[num] = (distribution[num] ?? 0) + 1
    totalStars += num
  }

  return {
    reviews: allReviews,
    summary: {
      totalReviews: allReviews.length,
      averageRating:
        allReviews.length > 0
          ? Math.round((totalStars / allReviews.length) * 10) / 10
          : 0,
      ratingDistribution: distribution,
    },
  }
}

/** Récupère uniquement les avis sans réponse du propriétaire */
export async function getUnansweredReviews(): Promise<GBPReview[]> {
  const { reviews } = await getAllReviews()
  return reviews.filter((r) => !r.reviewReply)
}

/** Poste une réponse à un avis Google */
export async function replyToReview(
  reviewName: string,
  responseText: string
): Promise<void> {
  const token = await getAccessToken()

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: responseText }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GBP Reply API ${res.status}: ${text}`)
  }
}

/** Récupère les stats de performance des 30 derniers jours */
export async function getPerformanceStats(): Promise<GBPPerformanceStats> {
  const { locationId } = await getLocationId()
  const token = await getAccessToken()

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 30)

  const formatDate = (d: Date) => ({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  })

  const dailyMetrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "ACTIONS_WEBSITE",
    "ACTIONS_DRIVING_DIRECTIONS",
    "ACTIONS_PHONE",
  ]

  const res = await fetch(
    `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dailyMetrics,
        dailyRange: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GBP Performance API ${res.status}: ${text}`)
  }

  const data = await res.json()
  return parsePerformanceData(data, startDate, endDate)
}

// ─── Helpers internes ───────────────────────────────────

/** Parse les données brutes de l'API Performance en stats agrégées */
function parsePerformanceData(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  startDate: Date,
  endDate: Date
): GBPPerformanceStats {
  const timeSeries = data.multiDailyMetricTimeSeries || []

  let searchViews = 0
  let mapsViews = 0
  let websiteClicks = 0
  let directionRequests = 0
  let phoneCallClicks = 0

  const dailyMap: Record<
    string,
    {
      date: string
      searchViews: number
      mapsViews: number
      websiteClicks: number
      directionRequests: number
      phoneCallClicks: number
    }
  > = {}

  for (const series of timeSeries) {
    const metric: string = series.dailyMetric ?? ""
    const datedValues =
      series.timeSeries?.datedValues ||
      series.dailyMetricTimeSeries?.timeSeries?.datedValues ||
      []

    for (const point of datedValues) {
      const d = point.date
      if (!d) continue
      const date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
      const value = parseInt(point.value ?? "0", 10)

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          searchViews: 0,
          mapsViews: 0,
          websiteClicks: 0,
          directionRequests: 0,
          phoneCallClicks: 0,
        }
      }

      if (metric.includes("SEARCH")) {
        dailyMap[date].searchViews += value
        searchViews += value
      } else if (metric.includes("MAPS")) {
        dailyMap[date].mapsViews += value
        mapsViews += value
      } else if (metric === "ACTIONS_WEBSITE") {
        dailyMap[date].websiteClicks += value
        websiteClicks += value
      } else if (metric === "ACTIONS_DRIVING_DIRECTIONS") {
        dailyMap[date].directionRequests += value
        directionRequests += value
      } else if (metric === "ACTIONS_PHONE") {
        dailyMap[date].phoneCallClicks += value
        phoneCallClicks += value
      }
    }
  }

  return {
    period: {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
    },
    searchViews,
    mapsViews,
    websiteClicks,
    directionRequests,
    phoneCallClicks,
    totalViews: searchViews + mapsViews,
    dailyBreakdown: Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  }
}
