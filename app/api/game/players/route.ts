import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// DELETE /api/game/players — supprime un joueur par id, ou tous si ?all=true
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const all = request.nextUrl.searchParams.get("all")
    const id = request.nextUrl.searchParams.get("id")

    if (all === "true") {
      const { error } = await supabase.from("game_plays").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      return NextResponse.json({ deleted: "all" })
    }

    if (id) {
      const { error } = await supabase.from("game_plays").delete().eq("id", id)
      if (error) throw error
      return NextResponse.json({ deleted: id })
    }

    return NextResponse.json({ error: "Paramètre manquant: ?id=xxx ou ?all=true" }, { status: 400 })
  } catch (error) {
    console.error("Game players delete error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}

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
