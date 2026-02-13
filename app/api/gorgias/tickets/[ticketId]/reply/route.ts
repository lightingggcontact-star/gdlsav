import { NextResponse, type NextRequest } from "next/server"
import { getGorgiasConfig, gorgiasFetch, invalidateTicketsCache } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    const { baseUrl, headers } = getGorgiasConfig()
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

    // Use the actual Gorgias email integration (SendGrid verified)
    const senderEmail = "bonjour@grainedelascars.com"
    const integrationId = 90515

    // Baba user profile in Gorgias (agent, julesgrainedelascars@outlook.fr)
    const babaUserId = 606027162

    // Create the message via Gorgias — sends the email through the email integration
    const messagePayload = {
      channel: "email",
      from_agent: true,
      via: "helpdesk",
      body_text: bodyText,
      body_html: bodyHtml || `<p>${bodyText.replace(/\n/g, "<br>")}</p>`,
      sender: {
        id: babaUserId,
      },
      source: {
        type: "email",
        from: { address: senderEmail, name: "Baba" },
        to: [{ address: customerEmail, name: customerName || customerEmail }],
      },
      integration_id: integrationId,
    }

    const res = await gorgiasFetch(`${baseUrl}/tickets/${ticketId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(messagePayload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("Gorgias reply error:", res.status, text)
      return NextResponse.json(
        { error: `Gorgias API ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    invalidateTicketsCache() // Force refresh on next fetch
    return NextResponse.json({ success: true, message: data })
  } catch (error) {
    console.error("Gorgias reply error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Gorgias" },
      { status: 500 }
    )
  }
}
