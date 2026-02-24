import { NextRequest, NextResponse } from "next/server"
import { fetchTracking } from "@/lib/laposte"
import { createClient } from "@/lib/supabase/server"
import type { LaPosteTracking } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * Check if tracking cache is still fresh.
 * Cache is considered fresh if updated_at is after the last refresh window
 * (8:25 or 13:00 Paris time today, whichever is the most recent past time).
 */
function isCacheFresh(updatedAt: string): boolean {
  const now = new Date()
  // Paris time offset: UTC+1 (CET) or UTC+2 (CEST)
  // Use Intl to get the actual Paris hour
  const parisHour = parseInt(
    new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now)
  )
  const parisMinute = parseInt(
    new Intl.DateTimeFormat("en", { minute: "numeric", timeZone: "Europe/Paris" }).format(now)
  )
  const parisTime = parisHour * 60 + parisMinute

  // Refresh windows at 8:25 (505 min) and 13:00 (780 min)
  let lastRefreshMinutes: number
  if (parisTime >= 780) {
    lastRefreshMinutes = 780 // After 13:00 → last refresh was 13:00
  } else if (parisTime >= 505) {
    lastRefreshMinutes = 505 // After 8:25 → last refresh was 8:25
  } else {
    // Before 8:25 → last refresh was yesterday 13:00
    // Cache from yesterday afternoon is still valid
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(12, 0, 0, 0) // Approximate — yesterday 13:00 Paris
    return new Date(updatedAt) > yesterday
  }

  // Build the last refresh timestamp in Paris time
  // Get today's date in Paris
  const parisDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now) // YYYY-MM-DD
  const lastRefreshHour = Math.floor(lastRefreshMinutes / 60)
  const lastRefreshMin = lastRefreshMinutes % 60
  const lastRefreshStr = `${parisDateStr}T${String(lastRefreshHour).padStart(2, "0")}:${String(lastRefreshMin).padStart(2, "0")}:00`

  // Parse in Paris TZ (approximate using offset)
  const parisOffset = now.getTimezoneOffset() // local offset
  const lastRefreshLocal = new Date(lastRefreshStr)
  // Adjust: we want this to be interpreted as Paris time
  // Simple approach: just check if updatedAt is recent enough (within last few hours)
  const cacheDate = new Date(updatedAt)
  const hoursSinceUpdate = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60)

  // If after 13:00 Paris: cache is fresh if updated in the last (now - 13:00) hours + buffer
  // If after 8:25 Paris and before 13:00: cache is fresh if updated in the last (now - 8:25) hours + buffer
  // Simplified: cache is fresh if updated less than 5 hours ago
  if (parisTime >= 780) {
    return hoursSinceUpdate < (parisTime - 780) / 60 + 0.5
  } else {
    return hoursSinceUpdate < (parisTime - 505) / 60 + 0.5
  }
}

/**
 * GET /api/tracking?numbers=XA001134936TS,CA688211167FR
 * Fetch La Poste tracking for one or more tracking numbers (max 10).
 * Always fetches live (no cache for single lookups).
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
      .slice(0, 10)

    if (numbers.length === 0) {
      return NextResponse.json(
        { error: "Aucun numéro de suivi fourni" },
        { status: 400 }
      )
    }

    const results = await fetchTracking(numbers)

    // Update cache for these numbers
    const supabase = await createClient()
    for (const r of results) {
      await supabase.from("tracking_cache").upsert({
        tracking_number: r.trackingNumber,
        data: r,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tracking_number" })
    }

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
 * Body: { numbers: ["XA001134936TS", ...], force?: boolean }
 * Uses cache when available and fresh. Falls back to live La Poste API.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const force = body.force === true
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

    const supabase = await createClient()
    let results: LaPosteTracking[] = []
    let numbersToFetch: string[] = numbers

    // Try cache first (unless forced)
    if (!force) {
      const { data: cached } = await supabase
        .from("tracking_cache")
        .select("tracking_number, data, updated_at")
        .in("tracking_number", numbers)

      if (cached && cached.length > 0) {
        const cachedMap = new Map<string, { data: LaPosteTracking; updated_at: string }>()
        for (const row of cached) {
          cachedMap.set(row.tracking_number, row)
        }

        // Check which are fresh
        const fresh: LaPosteTracking[] = []
        const stale: string[] = []

        for (const num of numbers) {
          const entry = cachedMap.get(num)
          if (entry && isCacheFresh(entry.updated_at)) {
            fresh.push(entry.data)
          } else {
            stale.push(num)
          }
        }

        results = fresh
        numbersToFetch = stale
      }
    }

    // Fetch remaining from La Poste
    if (numbersToFetch.length > 0) {
      const liveResults = await fetchTracking(numbersToFetch)
      results = [...results, ...liveResults]

      // Update cache
      const upserts = liveResults.map((r) => ({
        tracking_number: r.trackingNumber,
        data: r,
        updated_at: new Date().toISOString(),
      }))
      if (upserts.length > 0) {
        await supabase.from("tracking_cache").upsert(upserts, { onConflict: "tracking_number" })
      }
    }

    // Reorder results to match input order
    const resultMap = new Map(results.map((r) => [r.trackingNumber, r]))
    const orderedResults = numbers.map((num) => resultMap.get(num)).filter(Boolean) as LaPosteTracking[]

    return NextResponse.json({
      tracking: orderedResults,
      fetchedAt: new Date().toISOString(),
      fromCache: numbersToFetch.length === 0,
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
