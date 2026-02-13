import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = "https://api.fillout.com/v1/api"
const PAGE_SIZE = 150

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

// Server-side cache
let cached: { reviews: CriticalReview[]; fetchedAt: string } | null = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 min

async function fetchAllSubmissions(
  formId: string,
  headers: HeadersInit
): Promise<unknown[]> {
  const all: unknown[] = []
  let offset = 0
  while (true) {
    const res = await fetch(
      `${API_BASE}/forms/${formId}/submissions?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers }
    )
    if (!res.ok) return all
    const data = await res.json()
    const responses = data.responses || []
    all.push(...responses)
    if (responses.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    await new Promise((r) => setTimeout(r, 1050))
  }
  return all
}

export async function GET() {
  const key = process.env.FILLOUT_API_KEY
  if (!key) {
    return NextResponse.json({ error: "FILLOUT_API_KEY manquante" }, { status: 500 })
  }

  // Return cache if fresh
  if (cached && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cached)
  }

  const headers = { Authorization: `Bearer ${key}` }

  try {
    // 1. Get all forms
    const formsRes = await fetch(`${API_BASE}/forms`, { headers })
    if (!formsRes.ok) throw new Error("Failed to fetch forms")
    const forms: { formId: string; name: string; isPublished: boolean }[] = await formsRes.json()

    // 2. Get details for published forms to find those with OpinionScale
    const published = forms.filter((f) => f.isPublished)
    const formsWithRating: { formId: string; name: string }[] = []

    // Batch fetch details (5 at a time)
    for (let i = 0; i < published.length; i += 5) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1050))
      const batch = published.slice(i, i + 5)
      const results = await Promise.all(
        batch.map((f) => fetch(`${API_BASE}/forms/${f.formId}`, { headers }))
      )
      for (let j = 0; j < batch.length; j++) {
        if (results[j].ok) {
          const detail = await results[j].json()
          const hasScale = detail.questions?.some(
            (q: { type: string }) => q.type === "OpinionScale"
          )
          if (hasScale) {
            formsWithRating.push({ formId: batch[j].formId, name: batch[j].name })
          }
        }
      }
    }

    // 3. Fetch submissions from rated forms and extract critical reviews
    const criticalReviews: CriticalReview[] = []

    for (const form of formsWithRating) {
      const submissions = await fetchAllSubmissions(form.formId, headers)

      for (const sub of submissions) {
        const s = sub as {
          submissionId: string
          submissionTime: string
          questions: { id: string; name: string; type: string; value: unknown }[]
          urlParameters?: { name: string; value: string }[]
        }

        // Find rating
        const ratingQ = s.questions.find((q) => q.type === "OpinionScale")
        if (!ratingQ?.value || typeof ratingQ.value !== "number" || ratingQ.value > 3) continue

        // Extract email
        const emailFromUrl = s.urlParameters?.find(
          (p) => p.name.toLowerCase() === "email"
        )?.value
        const emailQ = s.questions.find(
          (q) => q.type === "EmailAddress" || /e-?mail/i.test(q.name)
        )
        const email = emailFromUrl || (emailQ?.value ? String(emailQ.value) : null)

        // Extract name
        const nameQ = s.questions.find(
          (q) => q.type === "ShortAnswer" && /pr[ée]nom/i.test(q.name)
        )
        const customerName = nameQ?.value ? String(nameQ.value) : null

        // Extract feedback text
        const textQ = s.questions.find(
          (q) =>
            (q.type === "ShortAnswer" || q.type === "LongAnswer") &&
            q.value &&
            !/pr[ée]nom|nom|e-?mail/i.test(q.name)
        )
        const feedback = textQ ? String(textQ.value) : null

        criticalReviews.push({
          submissionId: s.submissionId,
          formId: form.formId,
          formName: form.name,
          rating: ratingQ.value,
          email,
          customerName,
          feedback,
          submissionDate: s.submissionTime,
          allQuestions: s.questions.map((q) => ({ name: q.name, type: q.type, value: q.value })),
        })
      }

      // Rate limit safety between forms
      await new Promise((r) => setTimeout(r, 1050))
    }

    // Sort by date desc (most recent first)
    criticalReviews.sort(
      (a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
    )

    const result = { reviews: criticalReviews, fetchedAt: new Date().toISOString() }
    cached = result
    cacheTime = Date.now()

    return NextResponse.json(result)
  } catch (error) {
    console.error("SAV critical error:", error)
    if (cached) return NextResponse.json(cached)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur SAV" },
      { status: 500 }
    )
  }
}
