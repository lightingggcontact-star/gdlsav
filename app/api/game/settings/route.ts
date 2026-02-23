import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("game_settings")
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("Game settings error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Get current settings ID
    const { data: current } = await supabase
      .from("game_settings")
      .select("id")
      .single()

    if (!current) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof body.enabled === "boolean") {
      updates.enabled = body.enabled
    }

    if (Array.isArray(body.rewards)) {
      updates.rewards = body.rewards
    }

    const { data, error } = await supabase
      .from("game_settings")
      .update(updates)
      .eq("id", current.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("Game settings update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
