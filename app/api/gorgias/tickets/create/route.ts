import { NextResponse, type NextRequest } from "next/server"
import { getGorgiasConfig, gorgiasFetch, invalidateTicketsCache } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, headers } = getGorgiasConfig()
    const body = await request.json()

    const { customerEmail, customerName, subject, bodyText, bodyHtml } = body as {
      customerEmail: string
      customerName?: string
      subject: string
      bodyText: string
      bodyHtml?: string
    }

    if (!customerEmail || !subject || !bodyText) {
      return NextResponse.json(
        { error: "customerEmail, subject et bodyText requis" },
        { status: 400 }
      )
    }

    // Same sender config as reply route
    const senderEmail = "bonjour@grainedelascars.com"
    const integrationId = 90515
    const babaUserId = 606027162

    const ticketPayload = {
      channel: "email",
      subject,
      customer: {
        email: customerEmail,
        name: customerName || customerEmail,
      },
      messages: [
        {
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
        },
      ],
    }

    const res = await gorgiasFetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify(ticketPayload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("Gorgias create ticket error:", res.status, text)
      return NextResponse.json(
        { error: `Gorgias API ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    invalidateTicketsCache()
    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    console.error("Gorgias create ticket error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Gorgias" },
      { status: 500 }
    )
  }
}
