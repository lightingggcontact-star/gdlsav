import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const weeks = parseInt(searchParams.get("weeks") || "8", 10)

    // Fetch all analyzed tickets
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - weeks * 7)

    const { data: rows, error } = await supabase
      .from("ticket_analysis_categories")
      .select("ticket_id, category, ticket_created_at")
      .gte("ticket_created_at", cutoffDate.toISOString())
      .order("ticket_created_at", { ascending: true })

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) {
      return NextResponse.json({ weeks: [], categories: [] })
    }

    // Group by week + category
    const weekMap = new Map<string, Record<string, number>>()
    const allCategories = new Set<string>()

    for (const row of rows) {
      const d = new Date(row.ticket_created_at)
      const { year, week } = getISOWeek(d)
      const weekKey = `${year}-S${String(week).padStart(2, "0")}`

      allCategories.add(row.category)

      const weekData = weekMap.get(weekKey) || {}
      weekData[row.category] = (weekData[row.category] || 0) + 1
      weekMap.set(weekKey, weekData)
    }

    const weeksList = Array.from(weekMap.entries())
      .map(([label, categories]) => ({ label, categories }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return NextResponse.json({
      weeks: weeksList,
      categories: Array.from(allCategories).sort(),
    })
  } catch (error) {
    console.error("Trends analytics error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur analytics" },
      { status: 500 }
    )
  }
}
