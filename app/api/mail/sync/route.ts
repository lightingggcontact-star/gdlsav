import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncInbox } from "@/lib/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // Allow up to 60s for large syncs

export async function GET() {
  try {
    const supabase = await createClient()
    const result = await syncInbox(supabase)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Mail sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur sync IMAP" },
      { status: 500 }
    )
  }
}
