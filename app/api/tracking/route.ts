import { NextRequest, NextResponse } from "next/server"
import { fetchTracking } from "@/lib/laposte"

export const dynamic = "force-dynamic"

/**
 * GET /api/tracking?numbers=XA001134936TS,CA688211167FR
 * Fetch La Poste tracking for one or more tracking numbers (max 10).
 */
export async function GET(request: NextRequest) {
  try {
    const numbersParam = request.nextUrl.searchParams.get("numbers")

    if (!numbersParam) {
      return NextResponse.json(
        { error: "Paramètre 'numbers' requis" },
        { status: 400 }
      )
    }

    const numbers = numbersParam
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 10) // Max 10 per GET request

    if (numbers.length === 0) {
      return NextResponse.json(
        { error: "Aucun numéro de suivi fourni" },
        { status: 400 }
      )
    }

    const results = await fetchTracking(numbers)

    return NextResponse.json({
      tracking: results,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Tracking API error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du suivi",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tracking
 * Body: { numbers: ["XA001134936TS", "CA688211167FR", ...] }
 * Fetch La Poste tracking for many tracking numbers (max 100).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const numbers: string[] = (body.numbers ?? [])
      .map((n: string) => n.trim())
      .filter(Boolean)
      .slice(0, 100)

    if (numbers.length === 0) {
      return NextResponse.json(
        { error: "Aucun numéro de suivi fourni" },
        { status: 400 }
      )
    }

    const results = await fetchTracking(numbers)

    return NextResponse.json({
      tracking: results,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Tracking API error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du suivi",
      },
      { status: 500 }
    )
  }
}
