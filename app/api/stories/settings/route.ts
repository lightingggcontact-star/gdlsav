import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("stories_settings")
      .select("*")
      .single()

    if (error) throw error
    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("Stories settings GET error:", error)
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

    const { data: current } = await supabase
      .from("stories_settings")
      .select("id")
      .single()

    if (!current) {
      return NextResponse.json({ error: "Settings non trouvees" }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled
    if (body.circle_size) updates.circle_size = body.circle_size
    if (body.border_color) updates.border_color = body.border_color
    if (body.border_style) updates.border_style = body.border_style
    if (body.position) updates.position = body.position

    const { data, error } = await supabase
      .from("stories_settings")
      .update(updates)
      .eq("id", current.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("Stories settings PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
