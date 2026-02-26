import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { threadToTicket } from "@/lib/mail"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] })
  }

  try {
    const supabase = await createClient()
    const pattern = `%${q}%`

    // Search threads by customer name, email, or subject
    const { data: threads, error } = await supabase
      .from("email_threads")
      .select("*")
      .or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern},subject.ilike.${pattern}`)
      .order("last_message_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Search error:", error)
      return NextResponse.json({ data: [] })
    }

    const threadIds = new Set((threads || []).map(t => t.id))

    // Also search in message bodies for matching threads
    const { data: bodyMatches } = await supabase
      .from("email_messages")
      .select("thread_id")
      .ilike("body_text", pattern)
      .limit(200)

    const extraThreadIds = [...new Set((bodyMatches || []).map(m => m.thread_id))]
      .filter(id => !threadIds.has(id))

    let allThreads = threads || []
    if (extraThreadIds.length > 0) {
      const { data: extraThreads } = await supabase
        .from("email_threads")
        .select("*")
        .in("id", extraThreadIds.slice(0, 50))
        .order("last_message_at", { ascending: false })
      if (extraThreads) allThreads = [...allThreads, ...extraThreads]
    }

    const tickets = allThreads.map(threadToTicket)
    return NextResponse.json({ data: tickets })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur recherche" },
      { status: 500 }
    )
  }
}
