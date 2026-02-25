import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { threadToTicket } from "@/lib/mail"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch threads from Supabase (sync is done via /api/mail/sync)
    const { data: threads, error } = await supabase
      .from("email_threads")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(300)

    if (error) {
      console.error("Supabase threads error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const tickets = (threads || []).map(threadToTicket)
    return NextResponse.json({ data: tickets })
  } catch (error) {
    console.error("Tickets error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur tickets" },
      { status: 500 }
    )
  }
}
