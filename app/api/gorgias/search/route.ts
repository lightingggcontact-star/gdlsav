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

    // Search by customer name, email, or subject
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

    const tickets = (threads || []).map(threadToTicket)
    return NextResponse.json({ data: tickets })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur recherche" },
      { status: 500 }
    )
  }
}
