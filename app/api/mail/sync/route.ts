import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncInbox } from "@/lib/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 10

const BATCH_SIZE = 20
const TIME_LIMIT_MS = 8_000 // stop at 8s to leave margin before 10s timeout (Vercel Hobby)

export async function GET() {
  try {
    const supabase = await createClient()
    const startTime = Date.now()

    let totalSynced = 0
    let totalErrors = 0
    let allDone = false
    const allAgentThreadIds = new Set<string>()
    const allCustomerThreadIds = new Set<string>()

    // Loop in batches until done or near timeout
    while (!allDone) {
      const elapsed = Date.now() - startTime
      if (elapsed > TIME_LIMIT_MS) break

      const result = await syncInbox(supabase, BATCH_SIZE)
      totalSynced += result.synced
      totalErrors += result.errors
      allDone = result.done
      for (const id of result.agentLastThreadIds) {
        allAgentThreadIds.add(id)
        allCustomerThreadIds.delete(id) // agent overrides customer if same thread across batches
      }
      for (const id of result.customerLastThreadIds) {
        allCustomerThreadIds.add(id)
        allAgentThreadIds.delete(id) // customer overrides agent if same thread across batches
      }

      // If nothing was synced this round, stop
      if (result.synced === 0) break
    }

    const agentThreadIds = [...allAgentThreadIds]
    const customerThreadIds = [...allCustomerThreadIds]

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Auto-mark threads as replied where agent was the last sender
      if (agentThreadIds.length > 0) {
        const now = new Date().toISOString()
        for (let i = 0; i < agentThreadIds.length; i += 50) {
          const batch = agentThreadIds.slice(i, i + 50).map(tid => ({
            user_id: user.id,
            ticket_id: tid,
            replied_at: now,
          }))
          await supabase
            .from("ticket_replied_status")
            .upsert(batch, { onConflict: "user_id,ticket_id" })
        }
      }

      // Remove replied status for threads where customer replied last
      if (customerThreadIds.length > 0) {
        for (let i = 0; i < customerThreadIds.length; i += 50) {
          const batch = customerThreadIds.slice(i, i + 50)
          await supabase
            .from("ticket_replied_status")
            .delete()
            .eq("user_id", user.id)
            .in("ticket_id", batch)
        }
      }
    }

    return NextResponse.json({
      synced: totalSynced,
      errors: totalErrors,
      done: allDone,
      repliedThreadIds: agentThreadIds,
      unrepliedThreadIds: customerThreadIds,
    })
  } catch (error) {
    console.error("Mail sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync IMAP" },
      { status: 500 }
    )
  }
}
