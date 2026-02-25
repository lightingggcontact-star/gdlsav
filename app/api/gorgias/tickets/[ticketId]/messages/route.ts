import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { messageToGorgiasFormat } from "@/lib/mail"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const supabase = await createClient()

    const { data: messages, error } = await supabase
      .from("email_messages")
      .select("*")
      .eq("thread_id", ticketId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Messages fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (messages || []).map(messageToGorgiasFormat)
    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error("Messages error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur messages" },
      { status: 500 }
    )
  }
}
