import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    // Total players
    const { count: totalPlayers } = await supabase
      .from("game_plays")
      .select("*", { count: "exact", head: true })

    // Total tokens generated
    const { count: totalTokens } = await supabase
      .from("game_tokens")
      .select("*", { count: "exact", head: true })

    // Reward distribution
    const { data: plays } = await supabase
      .from("game_plays")
      .select("reward_key, reward_label, played_at")
      .order("played_at", { ascending: false })

    // Group rewards
    const rewardCounts: Record<string, { label: string; count: number }> = {}
    for (const play of plays ?? []) {
      if (!rewardCounts[play.reward_key]) {
        rewardCounts[play.reward_key] = { label: play.reward_label, count: 0 }
      }
      rewardCounts[play.reward_key].count++
    }

    const rewardDistribution = Object.entries(rewardCounts).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count,
    }))

    // Daily participations (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyMap: Record<string, number> = {}
    for (const play of plays ?? []) {
      const day = new Date(play.played_at).toISOString().split("T")[0]
      if (new Date(day) >= thirtyDaysAgo) {
        dailyMap[day] = (dailyMap[day] ?? 0) + 1
      }
    }

    const dailyParticipations = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Token statuses
    const { data: tokens } = await supabase
      .from("game_tokens")
      .select("status")

    const tokenStatuses: Record<string, number> = {}
    for (const t of tokens ?? []) {
      tokenStatuses[t.status] = (tokenStatuses[t.status] ?? 0) + 1
    }

    return NextResponse.json({
      totalPlayers: totalPlayers ?? 0,
      totalTokens: totalTokens ?? 0,
      rewardDistribution,
      dailyParticipations,
      tokenStatuses,
    })
  } catch (error) {
    console.error("Game stats error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
