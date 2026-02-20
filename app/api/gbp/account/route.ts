// app/api/gbp/account/route.ts
// GET — Infos de la fiche "Graine de Lascars" via Google Places API

import { NextResponse } from "next/server"
import { findPlace, getBusinessInfo } from "@/lib/gbp"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [placeId, businessInfo] = await Promise.all([
      findPlace(),
      getBusinessInfo(),
    ])

    return NextResponse.json({
      placeId,
      businessInfo,
    })
  } catch (error) {
    console.error("GBP account error:", error)
    const message =
      error instanceof Error ? error.message : "Erreur Google Places API"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
