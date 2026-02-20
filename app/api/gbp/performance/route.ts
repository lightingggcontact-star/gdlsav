// app/api/gbp/performance/route.ts
// GET — Statistiques de performance GBP (30 derniers jours)

import { NextResponse } from "next/server"
import { getPerformanceStats } from "@/lib/gbp"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const stats = await getPerformanceStats()

    // Sauvegarder dans output/performance.json
    try {
      const outputDir = path.join(process.cwd(), "output")
      await mkdir(outputDir, { recursive: true })
      await writeFile(
        path.join(outputDir, "performance.json"),
        JSON.stringify(
          { ...stats, exportedAt: new Date().toISOString() },
          null,
          2
        ),
        "utf-8"
      )
    } catch (fsError) {
      console.warn("Impossible d'écrire output/performance.json:", fsError)
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("GBP performance error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur GBP Performance",
      },
      { status: 500 }
    )
  }
}
