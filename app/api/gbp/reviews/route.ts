// app/api/gbp/reviews/route.ts
// GET — Avis Google via Places API (5 les plus pertinents)

import { NextResponse } from "next/server"
import { getReviews } from "@/lib/gbp"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { reviews, summary } = await getReviews()

    return NextResponse.json({
      reviews,
      summary,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("GBP reviews error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur Google Places Reviews",
      },
      { status: 500 }
    )
  }
}
