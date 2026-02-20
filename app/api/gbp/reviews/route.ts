// app/api/gbp/reviews/route.ts
// GET — Tous les avis Google avec pagination complète + résumé

import { NextResponse } from "next/server"
import { getAllReviews } from "@/lib/gbp"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { reviews, summary } = await getAllReviews()

    // Sauvegarder dans output/reviews.json
    try {
      const outputDir = path.join(process.cwd(), "output")
      await mkdir(outputDir, { recursive: true })
      await writeFile(
        path.join(outputDir, "reviews.json"),
        JSON.stringify(
          { reviews, summary, exportedAt: new Date().toISOString() },
          null,
          2
        ),
        "utf-8"
      )
    } catch (fsError) {
      console.warn("Impossible d'écrire output/reviews.json:", fsError)
    }

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
          error instanceof Error ? error.message : "Erreur GBP Reviews",
      },
      { status: 500 }
    )
  }
}
