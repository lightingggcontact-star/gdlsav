import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGorgiasConfig, gorgiasFetch, fetchAllTickets } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { baseUrl, headers } = getGorgiasConfig()

    // 1. Fetch all tickets from Gorgias
    const tickets = await fetchAllTickets(4)

    // 2. Get IDs already cached so we only fetch messages for new/updated ones
    const { data: existingRows } = await supabase
      .from("ticket_cache")
      .select("ticket_id, updated_at")

    const existingMap = new Map<number, string>()
    if (existingRows) {
      for (const row of existingRows) {
        existingMap.set(row.ticket_id, row.updated_at)
      }
    }

    // 3. Filter to tickets that need updating
    const toSync = tickets.filter((t: any) => {
      const cached = existingMap.get(t.id)
      if (!cached) return true
      return new Date(t.updated_datetime) > new Date(cached)
    })

    // 4. Fetch messages for tickets that need sync (batch of 10)
    let synced = 0
    for (let i = 0; i < toSync.length; i += 10) {
      const batch = toSync.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async (ticket: any) => {
          let firstMessage = ""
          let lastMessage = ""
          let messageCount = 0

          try {
            const res = await gorgiasFetch(
              `${baseUrl}/tickets/${ticket.id}/messages?limit=50&order_by=created_datetime:asc`,
              { headers }
            )
            if (res.ok) {
              const data = await res.json()
              const msgs = (data.data || []).filter((m: any) => m.public)
              messageCount = msgs.length
              if (msgs.length > 0) {
                const first = msgs[0]
                firstMessage = (first.body_text || stripHtml(first.body_html || "")).slice(0, 500)
                const last = msgs[msgs.length - 1]
                lastMessage = (last.body_text || stripHtml(last.body_html || "")).slice(0, 500)
              }
            }
          } catch { /* skip */ }

          return {
            ticket_id: ticket.id,
            subject: ticket.subject || null,
            status: ticket.status,
            priority: ticket.priority || "normal",
            customer_name: ticket.customer?.name || ticket.customer?.email || "?",
            customer_email: ticket.customer?.email || "",
            created_at: ticket.created_datetime,
            updated_at: ticket.updated_datetime,
            tags: (ticket.tags || []).map((t: any) => t.name),
            first_message: firstMessage,
            last_message: lastMessage,
            message_count: messageCount,
          }
        })
      )

      // Upsert into Supabase
      const { error } = await supabase
        .from("ticket_cache")
        .upsert(results, { onConflict: "ticket_id" })

      if (error) console.error("Sync upsert error:", error.message)
      synced += results.length
    }

    return NextResponse.json({
      total: tickets.length,
      synced,
      skipped: tickets.length - toSync.length,
    })
  } catch (error) {
    console.error("Gorgias sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync" },
      { status: 500 }
    )
  }
}
