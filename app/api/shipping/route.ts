import { NextRequest, NextResponse } from "next/server"
import { fetchFulfilledOrders } from "@/lib/shopify"
import { enrichOrders } from "@/lib/shipping-utils"
import { DEFAULT_THRESHOLDS } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const thresholdFR = parseInt(searchParams.get("thresholdFR") ?? String(DEFAULT_THRESHOLDS.fr))
    const thresholdBE = parseInt(searchParams.get("thresholdBE") ?? String(DEFAULT_THRESHOLDS.be))
    const startDate = searchParams.get("startDate") ?? undefined
    const endDate = searchParams.get("endDate") ?? undefined

    const orders = await fetchFulfilledOrders({ startDate, endDate })

    const enrichedOrders = enrichOrders(orders, {
      fr: thresholdFR,
      be: thresholdBE,
    })

    // Sort: delayed first, then in_transit, then delivered
    const sortOrder = { delayed: 0, in_transit: 1, delivered: 2 }
    enrichedOrders.sort(
      (a, b) => sortOrder[a.alertLevel] - sortOrder[b.alertLevel]
    )

    return NextResponse.json({
      orders: enrichedOrders,
      stats: {
        total: enrichedOrders.length,
        delayed: enrichedOrders.filter((o) => o.alertLevel === "delayed").length,
        inTransit: enrichedOrders.filter((o) => o.alertLevel === "in_transit").length,
        delivered: enrichedOrders.filter((o) => o.alertLevel === "delivered").length,
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Shipping API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors du chargement des commandes",
      },
      { status: 500 }
    )
  }
}
