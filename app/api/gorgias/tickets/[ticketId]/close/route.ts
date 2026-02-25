import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from("email_threads")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", ticketId)

    if (error) {
      console.error("Close thread error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, ticket: { id: ticketId, status: "closed" } })
  } catch (error) {
    console.error("Close error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur fermeture" },
      { status: 500 }
    )
  }
}
