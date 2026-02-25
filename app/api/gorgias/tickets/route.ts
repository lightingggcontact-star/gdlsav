import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncInbox, threadToTicket } from "@/lib/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // If ?sync=1, do IMAP sync first (triggered by Refresh button)
    const doSync = request.nextUrl.searchParams.get("sync") === "1"
    if (doSync) {
      await syncInbox(supabase)
    }

    // Fetch threads from Supabase
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
