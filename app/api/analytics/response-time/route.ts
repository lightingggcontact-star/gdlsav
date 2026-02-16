import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "week"

    const { data: rows, error } = await supabase
      .from("ticket_analysis_categories")
      .select("ticket_id, first_reply_at, ticket_created_at")
      .not("first_reply_at", "is", null)
      .order("ticket_created_at", { ascending: false })
      .limit(500)

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) {
      return NextResponse.json({ avgMinutes: 0, breakdown: [] })
    }

    // Compute response time in minutes for each ticket
    const entries = rows
      .map(row => {
        const created = new Date(row.ticket_created_at).getTime()
        const replied = new Date(row.first_reply_at).getTime()
        const diffMinutes = (replied - created) / (1000 * 60)
        return { date: row.ticket_created_at, minutes: diffMinutes > 0 ? diffMinutes : 0 }
      })
      .filter(e => e.minutes > 0 && e.minutes < 10080) // exclude outliers > 1 week

    if (entries.length === 0) {
      return NextResponse.json({ avgMinutes: 0, breakdown: [] })
    }

    // Overall average
    const avgMinutes = entries.reduce((sum, e) => sum + e.minutes, 0) / entries.length

    // Group by day or week
    const groupMap = new Map<string, { total: number; count: number }>()

    for (const entry of entries) {
      const d = new Date(entry.date)
      let key: string
      if (period === "month") {
        // Group by week
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay() + 1)
        key = weekStart.toISOString().slice(0, 10)
      } else {
        // Group by day
        key = d.toISOString().slice(0, 10)
      }

      const group = groupMap.get(key) || { total: 0, count: 0 }
      group.total += entry.minutes
      group.count += 1
      groupMap.set(key, group)
    }

    const breakdown = Array.from(groupMap.entries())
      .map(([date, { total, count }]) => ({
        date,
        avgMinutes: Math.round(total / count),
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      avgMinutes: Math.round(avgMinutes),
      ticketCount: entries.length,
      breakdown,
    })
  } catch (error) {
    console.error("Response time analytics error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur analytics" },
      { status: 500 }
    )
  }
}
