import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendAndStoreReply } from "@/lib/mail"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { bodyHtml, bodyText, customerEmail, customerName } = body as {
      bodyHtml: string
      bodyText: string
      customerEmail: string
      customerName?: string
    }

    if (!bodyText && !bodyHtml) {
      return NextResponse.json({ error: "bodyText ou bodyHtml requis" }, { status: 400 })
    }

    // Get thread subject for the reply
    const { data: thread } = await supabase
      .from("email_threads")
      .select("subject")
      .eq("id", ticketId)
      .single()

    const subject = thread?.subject ? `Re: ${thread.subject}` : "Re:"

    const { messageId } = await sendAndStoreReply(supabase, ticketId, {
      to: customerEmail,
      toName: customerName,
      subject,
      bodyText,
      bodyHtml: bodyHtml || `<p>${bodyText.replace(/\n/g, "<br>")}</p>`,
    })

    // Auto-mark as replied server-side
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from("ticket_replied_status")
        .upsert(
          { user_id: user.id, ticket_id: ticketId, replied_at: new Date().toISOString() },
          { onConflict: "user_id,ticket_id" }
        )
    }

    return NextResponse.json({ success: true, message: { id: messageId } })
  } catch (error) {
    console.error("Reply error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur envoi" },
      { status: 500 }
    )
  }
}
