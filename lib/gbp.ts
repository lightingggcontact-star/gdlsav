// lib/gbp.ts
// Service Google Places API (ancienne) — récupération des infos et avis de la fiche
// Fiche cible : "Graine de Lascars"
// Auth : API Key (pas besoin d'OAuth)

const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"

function getApiKey(): string {
  const key = process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error("GOOGLE_API_KEY requis dans .env.local")
  }
  return key
}

// ─── Types ───────────────────────────────────────────────

export interface GBPBusinessInfo {
  placeId: string
  title: string
  address: string
  phone: string
  website: string
  category: string
  mapsUrl: string
  averageRating: number
  totalReviews: number
  regularHours: {
    day: string
    openTime: string
    closeTime: string
  }[]
}

export interface GBPReview {
  reviewId: string
  name: string
  reviewer: {
    displayName: string
    profilePhotoUrl: string | null
  }
  rating: number
  comment: string | null
  createTime: string
  relativeTime: string
}

export interface GBPReviewsSummary {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
}

// ─── Cache serveur pour placeId ─────────────────────────

let cachedPlaceId: string | null = null

// ─── Helpers ─────────────────────────────────────────────

const DAY_INDEX_TO_NAME: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
}

// ─── Fonctions API ──────────────────────────────────────

/** Recherche "Graine de Lascars" et retourne le placeId */
export async function findPlace(): Promise<string> {
  if (cachedPlaceId) return cachedPlaceId

  const apiKey = getApiKey()

  const params = new URLSearchParams({
    input: "Graine de Lascars",
    inputtype: "textquery",
    fields: "place_id,name",
    language: "fr",
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API_BASE}/findplacefromtext/json?${params}`)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places Find Place API ${res.status}: ${text}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const data: any = await res.json()

  if (data.status !== "OK" || !data.candidates?.length) {
    throw new Error(`Aucun lieu trouvé pour 'Graine de Lascars' (status: ${data.status})`)
  }

  cachedPlaceId = data.candidates[0].place_id
  return cachedPlaceId!
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Récupère les informations complètes de la fiche */
export async function getBusinessInfo(): Promise<GBPBusinessInfo> {
  const placeId = await findPlace()
  const apiKey = getApiKey()

  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "international_phone_number",
    "website",
    "url",
    "rating",
    "user_ratings_total",
    "opening_hours",
    "types",
  ].join(",")

  const params = new URLSearchParams({
    place_id: placeId,
    fields,
    language: "fr",
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API_BASE}/details/json?${params}`)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places Details API ${res.status}: ${text}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const data: any = await res.json()

  if (data.status !== "OK") {
    throw new Error(`Places Details API erreur: ${data.status} — ${data.error_message ?? ""}`)
  }

  const place = data.result

  // Parser les horaires
  const regularHours: GBPBusinessInfo["regularHours"] = []
  const periods = place.opening_hours?.periods || []
  for (const p of periods) {
    if (p.open && p.close) {
      regularHours.push({
        day: DAY_INDEX_TO_NAME[p.open.day] ?? String(p.open.day),
        openTime: p.open.time
          ? `${p.open.time.slice(0, 2)}:${p.open.time.slice(2)}`
          : "00:00",
        closeTime: p.close.time
          ? `${p.close.time.slice(0, 2)}:${p.close.time.slice(2)}`
          : "00:00",
      })
    }
  }

  return {
    placeId: place.place_id ?? "",
    title: place.name ?? "",
    address: place.formatted_address ?? "",
    phone: place.international_phone_number ?? place.formatted_phone_number ?? "",
    website: place.website ?? "",
    category: place.types?.[0]?.replace(/_/g, " ") ?? "",
    mapsUrl: place.url ?? "",
    averageRating: place.rating ?? 0,
    totalReviews: place.user_ratings_total ?? 0,
    regularHours,
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Récupère les avis (jusqu'à 5 les plus pertinents via Places API) */
export async function getReviews(): Promise<{
  reviews: GBPReview[]
  summary: GBPReviewsSummary
}> {
  const placeId = await findPlace()
  const apiKey = getApiKey()

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "reviews,rating,user_ratings_total",
    language: "fr",
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API_BASE}/details/json?${params}`)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places Reviews API ${res.status}: ${text}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const data: any = await res.json()

  if (data.status !== "OK") {
    throw new Error(`Places Reviews API erreur: ${data.status} — ${data.error_message ?? ""}`)
  }

  const place = data.result

  const reviews: GBPReview[] = (place.reviews || []).map(
    (r: any, i: number) => ({
      reviewId: `review-${i}`,
      name: r.author_name ?? "",
      reviewer: {
        displayName: r.author_name ?? "Anonyme",
        profilePhotoUrl: r.profile_photo_url ?? null,
      },
      rating: r.rating ?? 0,
      comment: r.text ?? null,
      createTime: r.time ? new Date(r.time * 1000).toISOString() : "",
      relativeTime: r.relative_time_description ?? "",
    })
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const totalReviews = place.user_ratings_total ?? reviews.length
  const averageRating = place.rating ?? 0

  // Distribution depuis les avis récupérés
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const review of reviews) {
    const r = Math.round(review.rating)
    if (r >= 1 && r <= 5) {
      distribution[r] = (distribution[r] ?? 0) + 1
    }
  }

  return {
    reviews,
    summary: {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution: distribution,
    },
  }
}
