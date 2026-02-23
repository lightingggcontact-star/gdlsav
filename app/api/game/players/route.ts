import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const search = request.nextUrl.searchParams.get("search") ?? ""

    let query = supabase
      .from("game_plays")
      .select("*")
      .order("played_at", { ascending: false })

    if (search) {
      query = query.or(`email.ilike.%${search}%,customer_name.ilike.%${search}%,reward_label.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ players: data ?? [] })
  } catch (error) {
    console.error("Game players error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
