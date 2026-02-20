// lib/gbp.ts
// Service Google Places API (New) — récupération des infos et avis de la fiche
// Fiche cible : "Graine de Lascars"
// Auth : API Key (pas besoin d'OAuth)

const PLACES_API_BASE = "https://places.googleapis.com/v1"

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

// ─── Fonctions API ──────────────────────────────────────

/** Recherche "Graine de Lascars" et retourne le placeId */
export async function findPlace(): Promise<string> {
  if (cachedPlaceId) return cachedPlaceId

  const apiKey = getApiKey()

  const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({
      textQuery: "Graine de Lascars",
      languageCode: "fr",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places Text Search API ${res.status}: ${text}`)
  }

  const data = await res.json()
  const places = data.places || []

  if (places.length === 0) {
    throw new Error("Aucun lieu trouvé pour 'Graine de Lascars'")
  }

  cachedPlaceId = places[0].id
  return cachedPlaceId!
}

/** Récupère les informations complètes de la fiche */
export async function getBusinessInfo(): Promise<GBPBusinessInfo> {
  const placeId = await findPlace()
  const apiKey = getApiKey()

  const fieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "regularOpeningHours",
    "primaryTypeDisplayName",
  ].join(",")

  const res = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places Details API ${res.status}: ${text}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const place: any = await res.json()

  // Parser les horaires
  const regularHours: GBPBusinessInfo["regularHours"] = []
  const periods = place.regularOpeningHours?.periods || []
  for (const p of periods) {
    if (p.open && p.close) {
      regularHours.push({
        day: p.open.day ?? "",
        openTime: `${String(p.open.hour ?? 0).padStart(2, "0")}:${String(p.open.minute ?? 0).padStart(2, "0")}`,
        closeTime: `${String(p.close.hour ?? 0).padStart(2, "0")}:${String(p.close.minute ?? 0).padStart(2, "0")}`,
      })
    }
  }

  return {
    placeId: place.id ?? "",
    title: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? "",
    website: place.websiteUri ?? "",
    category: place.primaryTypeDisplayName?.text ?? "",
    mapsUrl: place.googleMapsUri ?? "",
    averageRating: place.rating ?? 0,
    totalReviews: place.userRatingCount ?? 0,
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

  const res = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "reviews,rating,userRatingCount",
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places Reviews API ${res.status}: ${text}`)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const data: any = await res.json()

  const reviews: GBPReview[] = (data.reviews || []).map(
    (r: any, i: number) => ({
      reviewId: `review-${i}`,
      name: r.name ?? "",
      reviewer: {
        displayName: r.authorAttribution?.displayName ?? "Anonyme",
        profilePhotoUrl: r.authorAttribution?.photoUri ?? null,
      },
      rating: r.rating ?? 0,
      comment: r.originalText?.text ?? r.text?.text ?? null,
      createTime: r.publishTime ?? "",
      relativeTime: r.relativePublishTimeDescription ?? "",
    })
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Résumé basé sur les données globales de la fiche (pas juste les 5 avis)
  const totalReviews = data.userRatingCount ?? reviews.length
  const averageRating = data.rating ?? 0

  // Distribution estimée depuis les avis récupérés
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
