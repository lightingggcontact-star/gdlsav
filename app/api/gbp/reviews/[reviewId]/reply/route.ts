// app/api/gbp/reviews/[reviewId]/reply/route.ts
// POST — Répondre à un avis Google sur la fiche "Graine de Lascars"

import { NextResponse, type NextRequest } from "next/server"
import { replyToReview } from "@/lib/gbp"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    await params // Valider que le param existe
    const body = await request.json()
    const { reviewName, responseText } = body as {
      reviewName: string // Resource name complet : "accounts/xxx/locations/xxx/reviews/xxx"
      responseText: string
    }

    if (!reviewName || !responseText?.trim()) {
      return NextResponse.json(
        { error: "reviewName et responseText sont requis" },
        { status: 400 }
      )
    }

    await replyToReview(reviewName, responseText.trim())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("GBP reply error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur GBP Reply",
      },
      { status: 500 }
    )
  }
}
