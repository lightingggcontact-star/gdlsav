import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderedIds } = (await request.json()) as { orderedIds: string[] }

    const updates = orderedIds.map((id, index) =>
      supabase
        .from("stories_videos")
        .update({ display_order: index })
        .eq("id", id)
    )

    await Promise.all(updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Stories reorder error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
