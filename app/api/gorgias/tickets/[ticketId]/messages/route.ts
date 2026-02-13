import { NextResponse } from "next/server"
import { getGorgiasConfig, gorgiasFetch } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const { baseUrl, headers } = getGorgiasConfig()

    const res = await gorgiasFetch(
      `${baseUrl}/tickets/${ticketId}/messages?limit=100&order_by=created_datetime:asc`,
      { headers }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Gorgias API ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Gorgias messages error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Gorgias" },
      { status: 500 }
    )
  }
}
