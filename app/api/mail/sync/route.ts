import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncInbox } from "@/lib/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BATCH_SIZE = 150
const TIME_LIMIT_MS = 50_000 // stop at 50s to leave margin before 60s timeout

export async function GET() {
  try {
    const supabase = await createClient()
    const startTime = Date.now()

    let totalSynced = 0
    let totalErrors = 0
    let allDone = false

    // Loop in batches until done or near timeout
    while (!allDone) {
      const elapsed = Date.now() - startTime
      if (elapsed > TIME_LIMIT_MS) break

      const result = await syncInbox(supabase, BATCH_SIZE)
      totalSynced += result.synced
      totalErrors += result.errors
      allDone = result.done

      // If nothing was synced this round, stop
      if (result.synced === 0) break
    }

    return NextResponse.json({
      synced: totalSynced,
      errors: totalErrors,
      done: allDone,
    })
  } catch (error) {
    console.error("Mail sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync IMAP" },
      { status: 500 }
    )
  }
}
