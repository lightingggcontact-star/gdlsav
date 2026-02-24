import { NextRequest, NextResponse } from "next/server"
import { fetchFulfilledOrders } from "@/lib/shopify"
import { fetchTracking } from "@/lib/laposte"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // Allow up to 60s for large batches

/**
 * GET /api/cron/refresh-tracking
 * Called by Vercel Cron at 8:25 and 13:00 Paris time.
 * Fetches all active tracking numbers from recent Shopify orders,
 * calls La Poste API, and updates the cache.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header automatically for cron jobs)
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Fetch recent fulfilled orders (last 30 days by default)
    const orders = await fetchFulfilledOrders({})

    // Extract unique tracking numbers
    const trackingNumbers = orders
      .flatMap((o) => o.fulfillments)
      .map((f) => f.trackingNumber)
      .filter((n): n is string => !!n)
      .filter((n, i, arr) => arr.indexOf(n) === i)

    if (trackingNumbers.length === 0) {
      return NextResponse.json({ message: "No tracking numbers to refresh", count: 0 })
    }

    // Fetch from La Poste (handles batching internally, max 10 per request)
    const results = await fetchTracking(trackingNumbers)

    // Update cache in Supabase
    const supabase = await createClient()
    const now = new Date().toISOString()
    const upserts = results.map((r) => ({
      tracking_number: r.trackingNumber,
      data: r,
      updated_at: now,
    }))

    // Batch upsert in chunks of 50
    for (let i = 0; i < upserts.length; i += 50) {
      const chunk = upserts.slice(i, i + 50)
      await supabase.from("tracking_cache").upsert(chunk, { onConflict: "tracking_number" })
    }

    return NextResponse.json({
      message: "Tracking cache refreshed",
      count: results.length,
      refreshedAt: now,
    })
  } catch (error) {
    console.error("Cron refresh-tracking error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur cron" },
      { status: 500 }
    )
  }
}
