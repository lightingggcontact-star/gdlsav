import { NextResponse } from "next/server"
import { fetchAllTickets } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Uses server-side cache (30s TTL) + in-flight deduplication
    // Max 4 pages (200 tickets) instead of 10 to reduce API calls
    const allTickets = await fetchAllTickets(4)
    return NextResponse.json({ data: allTickets })
  } catch (error) {
    console.error("Gorgias tickets error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Gorgias" },
      { status: 500 }
    )
  }
}
