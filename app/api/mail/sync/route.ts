import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncInbox } from "@/lib/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 10
export const preferredRegion = "cdg1" // Paris — proche de Zoho EU

export async function GET() {
  try {
    const supabase = await createClient()

    // Single sync call with 7s time limit (leaves margin for auth + response)
    const result = await syncInbox(supabase, 50, 7000)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const now = new Date().toISOString()
      // Auto-mark threads as replied where agent was the last sender
      if (result.agentLastThreadIds.length > 0) {
        const batch = result.agentLastThreadIds.map(tid => ({
          user_id: user.id,
          ticket_id: tid,
          replied_at: now,
        }))
        await supabase
          .from("ticket_replied_status")
          .upsert(batch, { onConflict: "user_id,ticket_id" })
      }

      // Remove replied status for threads where customer replied last
      if (result.customerLastThreadIds.length > 0) {
        await supabase
          .from("ticket_replied_status")
          .delete()
          .eq("user_id", user.id)
          .in("ticket_id", result.customerLastThreadIds)
      }
    }

    return NextResponse.json({
      synced: result.synced,
      errors: result.errors,
      done: result.done,
      repliedThreadIds: result.agentLastThreadIds,
      unrepliedThreadIds: result.customerLastThreadIds,
    })
  } catch (error) {
    console.error("Mail sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync IMAP" },
      { status: 500 }
    )
  }
}
