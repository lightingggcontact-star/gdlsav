import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncInbox } from "@/lib/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function classifyTicket(subject: string | null, firstMessage: string): string {
  const text = `${subject || ""} ${firstMessage}`.toLowerCase()
  if (/colis|livraison|suivi|tracking|expédi|transporteur|retard|chrono|colissimo|la poste/.test(text)) return "livraison"
  if (/rembours|avoir|annul/.test(text)) return "remboursement"
  if (/endommagé|cassé|abîmé|qualité|goût|moisi|périmé/.test(text)) return "qualite"
  if (/code promo|réduction|cashback|points|fidélité/.test(text)) return "promo_fidelite"
  if (/retour|renvoi|échange/.test(text)) return "retour"
  if (/question|renseignement|comment|quoi|quel/.test(text)) return "question"
  return "autre"
}

export async function POST() {
  try {
    const supabase = await createClient()

    // 1. Sync IMAP first
    const syncResult = await syncInbox(supabase)

    // 2. Get all threads with their first message for classification
    const { data: threads } = await supabase
      .from("email_threads")
      .select("id, subject, created_at, updated_at, status, customer_name, customer_email, message_count")
      .order("last_message_at", { ascending: false })
      .limit(300)

    if (!threads?.length) {
      return NextResponse.json({ total: 0, synced: 0, skipped: 0 })
    }

    // 3. Get existing cached IDs
    const { data: existingRows } = await supabase
      .from("ticket_cache")
      .select("ticket_id, updated_at")

    const existingMap = new Map<string, string>()
    if (existingRows) {
      for (const row of existingRows) {
        existingMap.set(String(row.ticket_id), row.updated_at)
      }
    }

    // 4. Filter to threads that need updating
    const toSync = threads.filter((t) => {
      const cached = existingMap.get(t.id)
      if (!cached) return true
      return new Date(t.updated_at) > new Date(cached)
    })

    let synced = 0
    for (let i = 0; i < toSync.length; i += 10) {
      const batch = toSync.slice(i, i + 10)

      const batchData = await Promise.all(
        batch.map(async (thread) => {
          // Get first and last message
          const { data: messages } = await supabase
            .from("email_messages")
            .select("body_text, body_html, from_agent, created_at")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: true })

          const publicMsgs = messages || []
          const firstMsg = publicMsgs[0]
          const lastMsg = publicMsgs[publicMsgs.length - 1]
          const firstMessage = (firstMsg?.body_text || "").slice(0, 500)
          const lastMessage = (lastMsg?.body_text || "").slice(0, 500)
          const firstAgentMsg = publicMsgs.find((m) => m.from_agent)

          const category = classifyTicket(thread.subject, firstMessage)

          return {
            cache: {
              ticket_id: thread.id,
              subject: thread.subject,
              status: thread.status,
              priority: "normal",
              customer_name: thread.customer_name,
              customer_email: thread.customer_email,
              created_at: thread.created_at,
              updated_at: thread.updated_at,
              tags: [],
              first_message: firstMessage,
              last_message: lastMessage,
              message_count: thread.message_count,
            },
            analysis: {
              ticket_id: thread.id,
              category,
              first_reply_at: firstAgentMsg?.created_at || null,
              ticket_created_at: thread.created_at,
              analyzed_at: new Date().toISOString(),
            },
          }
        })
      )

      await supabase
        .from("ticket_cache")
        .upsert(batchData.map((d) => d.cache), { onConflict: "ticket_id" })

      await supabase
        .from("ticket_analysis_categories")
        .upsert(batchData.map((d) => d.analysis), { onConflict: "ticket_id" })

      synced += batchData.length
    }

    return NextResponse.json({
      total: threads.length,
      synced,
      skipped: threads.length - toSync.length,
      imapSynced: syncResult.synced,
    })
  } catch (error) {
    console.error("Sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync" },
      { status: 500 }
    )
  }
}
