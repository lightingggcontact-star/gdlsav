// app/api/gbp/account/route.ts
// GET — Infos du compte GBP + fiche "Graine de Lascars"

import { NextResponse } from "next/server"
import { getBusinessInfo, getLocationId } from "@/lib/gbp"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [location, businessInfo] = await Promise.all([
      getLocationId(),
      getBusinessInfo(),
    ])

    return NextResponse.json({
      accountId: location.accountId,
      locationId: location.locationId,
      locationName: location.locationName,
      businessInfo,
    })
  } catch (error) {
    console.error("GBP account error:", error)
    const message =
      error instanceof Error ? error.message : "Erreur Google Business Profile"
    const status =
      error instanceof Error && message.includes("403") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
