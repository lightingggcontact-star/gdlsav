import { NextRequest, NextResponse } from "next/server"
import { fetchFulfilledOrders } from "@/lib/shopify"
import { enrichOrders } from "@/lib/shipping-utils"
import { DEFAULT_THRESHOLDS } from "@/lib/types"
import type { ShippingStatus } from "@/lib/types"

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

    // Sort: problems first, then delayed, then in_transit, then delivered
    const sortOrder: Record<ShippingStatus, number> = {
      problem: 0,
      returned: 1,
      delayed: 2,
      out_for_delivery: 3,
      in_transit: 4,
      pickup_ready: 5,
      delivered: 6,
    }
    enrichedOrders.sort(
      (a, b) => sortOrder[a.alertLevel] - sortOrder[b.alertLevel]
    )

    // Count per status
    const counts: Record<ShippingStatus, number> = {
      delivered: 0,
      pickup_ready: 0,
      out_for_delivery: 0,
      in_transit: 0,
      delayed: 0,
      problem: 0,
      returned: 0,
    }
    for (const o of enrichedOrders) {
      counts[o.alertLevel]++
    }

    return NextResponse.json({
      orders: enrichedOrders,
      stats: {
        total: enrichedOrders.length,
        ...counts,
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
