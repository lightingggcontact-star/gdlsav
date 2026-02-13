import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = "https://api.fillout.com/v1/api"

interface FormScore {
  formId: string
  avgRating: number | null
  totalResponses: number
  hasRating: boolean
}

// Parallel batch fetch: fire `batchSize` requests at once, wait between batches
async function batchFetch(urls: string[], headers: HeadersInit, batchSize = 5): Promise<Response[]> {
  const results: Response[] = []
  for (let i = 0; i < urls.length; i += batchSize) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1050))
    const batch = urls.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map((url) => fetch(url, { headers })))
    results.push(...batchResults)
  }
  return results
}

// In-memory cache (survives across requests in the same server process)
let cachedScores: { scores: Record<string, FormScore>; fetchedAt: string } | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 min

export async function GET() {
  const key = process.env.FILLOUT_API_KEY
  if (!key) {
    return NextResponse.json({ error: "FILLOUT_API_KEY manquante" }, { status: 500 })
  }

  // Return cache if fresh
  if (cachedScores && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedScores)
  }

  const headers = { Authorization: `Bearer ${key}` }

  try {
    // 1. Get all forms
    const formsRes = await fetch(`${API_BASE}/forms`, { headers })
    if (!formsRes.ok) throw new Error("Failed to fetch forms")
    const forms: { formId: string; name: string; isPublished: boolean }[] = await formsRes.json()

    // 2. Get details for published forms (parallel batches of 5)
    const published = forms.filter((f) => f.isPublished)
    const detailUrls = published.map((f) => `${API_BASE}/forms/${f.formId}`)
    const detailResponses = await batchFetch(detailUrls, headers)

    const formsWithRating: string[] = []
    for (let i = 0; i < published.length; i++) {
      if (detailResponses[i].ok) {
        const detail = await detailResponses[i].json()
        const hasScale = detail.questions?.some((q: { type: string }) => q.type === "OpinionScale")
        if (hasScale) formsWithRating.push(published[i].formId)
      }
    }

    // 3. Fetch ALL submissions for forms with ratings (paginate each form)
    // Fillout API caps totalResponses at limit, so we must keep fetching while page is full
    async function fetchAllSubmissions(fId: string): Promise<{ responses: unknown[]; total: number }> {
      const all: unknown[] = []
      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch(`${API_BASE}/forms/${fId}/submissions?limit=150&offset=${offset}`, { headers })
        if (!res.ok) return { responses: all, total: all.length }
        const data = await res.json()
        const responses = data.responses || []
        all.push(...responses)
        if (responses.length < 150) break
        offset += 150
        // Rate limit safety between pages
        await new Promise((r) => setTimeout(r, 1050))
      }
      return { responses: all, total: all.length }
    }

    const scores: Record<string, FormScore> = {}
    // Process forms sequentially to respect rate limits
    for (const formId of formsWithRating) {
      const { responses, total } = await fetchAllSubmissions(formId)
      const ratings: number[] = []

      for (const sub of responses) {
        const ratingQ = (sub as { questions?: { type: string; value: unknown }[] }).questions?.find((q) => q.type === "OpinionScale")
        if (ratingQ?.value != null && typeof ratingQ.value === "number") {
          ratings.push(ratingQ.value)
        }
      }

      scores[formId] = {
        formId,
        avgRating: ratings.length > 0 ? Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 10) / 10 : null,
        totalResponses: total,
        hasRating: true,
      }
    }

    const result = { scores, fetchedAt: new Date().toISOString() }
    cachedScores = result
    cacheTime = Date.now()

    return NextResponse.json(result)
  } catch (error) {
    console.error("Fillout scores error:", error)
    // Return stale cache on error if available
    if (cachedScores) return NextResponse.json(cachedScores)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Fillout" },
      { status: 500 }
    )
  }
}
