import { NextResponse } from "next/server"
import { getGorgiasConfig, gorgiasFetch, invalidateTicketsCache } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const { baseUrl, headers } = getGorgiasConfig()

    const res = await gorgiasFetch(`${baseUrl}/tickets/${ticketId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: "closed" }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("Gorgias close error:", res.status, text)
      return NextResponse.json(
        { error: `Gorgias API ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    invalidateTicketsCache() // Force refresh on next fetch
    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    console.error("Gorgias close error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Gorgias" },
      { status: 500 }
    )
  }
}
