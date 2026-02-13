import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const SMS8_API_KEY = process.env.SMS8_API_KEY
const SMS8_DEVICE_ID = process.env.SMS8_DEVICE_ID || "6078"
const SMS8_BASE = "https://app.sms8.io/services"

export async function POST(request: NextRequest) {
  if (!SMS8_API_KEY) {
    return NextResponse.json({ error: "SMS8_API_KEY non configurée" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { number, message } = body

    if (!number || !message) {
      return NextResponse.json({ error: "number et message requis" }, { status: 400 })
    }

    // Build SMS8 send URL
    const devices = JSON.stringify([`${SMS8_DEVICE_ID}|0`])
    const url = new URL(`${SMS8_BASE}/send.php`)
    url.searchParams.set("key", SMS8_API_KEY)
    url.searchParams.set("number", number)
    url.searchParams.set("message", message)
    url.searchParams.set("devices", devices)
    url.searchParams.set("type", "sms")
    url.searchParams.set("prioritize", "1")

    const res = await fetch(url.toString())
    const data = await res.json()

    if (!data.success) {
      return NextResponse.json(
        { error: data.error?.message || "Erreur envoi SMS" },
        { status: data.error?.code || 500 }
      )
    }

    return NextResponse.json({ success: true, data: data.data })
  } catch (error) {
    console.error("SMS8 send error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur envoi SMS" },
      { status: 500 }
    )
  }
}
