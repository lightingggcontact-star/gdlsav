import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = "https://api.fillout.com/v1/api"

const PAGE_SIZE = 150

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const key = process.env.FILLOUT_API_KEY
  if (!key) {
    return NextResponse.json({ error: "FILLOUT_API_KEY manquante" }, { status: 500 })
  }

  const { searchParams } = request.nextUrl
  const afterDate = searchParams.get("afterDate") || ""
  const beforeDate = searchParams.get("beforeDate") || ""

  const headers = { Authorization: `Bearer ${key}` }

  try {
    // Fetch all pages automatically
    // NOTE: Fillout API lies about totalResponses — it returns min(actual, limit)
    // So we can't rely on it. Instead, keep fetching while page is full.
    const allResponses: unknown[] = []
    let offset = 0
    let pages = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const url = new URL(`${API_BASE}/forms/${formId}/submissions`)
      url.searchParams.set("limit", String(PAGE_SIZE))
      url.searchParams.set("offset", String(offset))
      if (afterDate) url.searchParams.set("afterDate", afterDate)
      if (beforeDate) url.searchParams.set("beforeDate", beforeDate)

      const res = await fetch(url.toString(), { headers })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Fillout API ${res.status}: ${text}`)
      }
      const data = await res.json()
      const responses = data.responses || []
      allResponses.push(...responses)
      pages++

      // Stop only when we get fewer results than PAGE_SIZE (= last page)
      if (responses.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    console.log(`[Fillout] ${formId}: fetched ${allResponses.length} submissions (${pages} pages)`)

    return NextResponse.json({
      responses: allResponses,
      totalResponses: allResponses.length,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Fillout submissions error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Fillout" },
      { status: 500 }
    )
  }
}
