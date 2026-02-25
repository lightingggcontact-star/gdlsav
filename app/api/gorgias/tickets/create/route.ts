import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAndSendThread } from "@/lib/mail"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    const { threadId, messageId } = await createAndSendThread(supabase, {
      to: customerEmail,
      toName: customerName,
      subject,
      bodyText,
      bodyHtml: bodyHtml || `<p>${bodyText.replace(/\n/g, "<br>")}</p>`,
    })

    return NextResponse.json({
      success: true,
      ticket: { id: threadId, messageId },
    })
  } catch (error) {
    console.error("Create ticket error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur creation" },
      { status: 500 }
    )
  }
}
