import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SMS8_API_KEY = process.env.SMS8_API_KEY
const SMS8_BASE = "https://app.sms8.io/services"

interface RawSmsMessage {
  ID: number
  userID: number
  number: string
  deliveredDate: string
  deviceID: number
  simSlot: number | null
  message: string
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&agrave;/g, "à")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&ecirc;/g, "ê")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&ccedil;/g, "ç")
    .replace(/&iuml;/g, "ï")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function normalizePhone(num: string): string {
  let n = num.replace(/\s+/g, "").trim()
  // French numbers: 06/07 → +336/+337
  if (/^0[67]\d{8}$/.test(n)) {
    n = "+33" + n.slice(1)
  }
  // Other French numbers starting with 0
  if (/^0\d{9}$/.test(n)) {
    n = "+33" + n.slice(1)
  }
  return n
}

// Filter out spam/system senders
function isSpam(number: string, message: string): boolean {
  const n = number.toLowerCase()
  const m = message.toLowerCase()
  // Voicemail
  if (n === "0660660001" || n === "+33660660001") return true
  // Carrier names
  if (n === "chronopost" || n === "colissimo" || n === "laposte") return true
  // Short codes (< 6 digits, not a real phone number)
  const digits = n.replace(/\D/g, "")
  if (digits.length > 0 && digits.length < 6) return true
  // Voicemail content
  if (m.includes("boite vocale") || m.includes("messagerie vocale")) return true
  return false
}

// Max sent messages to process (API returns 33k+, sorted newest first)
const MAX_SENT = 300

export async function GET() {
  if (!SMS8_API_KEY) {
    return NextResponse.json({ error: "SMS8_API_KEY non configurée" }, { status: 500 })
  }

  try {
    // Fetch Received + Sent in parallel (skip Delivered, always 0)
    const [receivedRes, sentRes] = await Promise.all([
      fetch(`${SMS8_BASE}/get-msgs.php?key=${SMS8_API_KEY}&status=Received`),
      fetch(`${SMS8_BASE}/get-msgs.php?key=${SMS8_API_KEY}&status=Sent`),
    ])

    const [receivedData, sentData] = await Promise.all([
      receivedRes.json(),
      sentRes.json(),
    ])

    const receivedMsgs: RawSmsMessage[] = receivedData.data?.messages || []
    // Only take the N most recent sent messages (API returns newest first)
    const sentMsgs: RawSmsMessage[] = (sentData.data?.messages || []).slice(0, MAX_SENT)

    // Collect all messages, dedup by ID, tag direction
    const seenIds = new Set<number>()
    const allMessages: { id: number; phone: string; message: string; date: string; direction: "in" | "out" }[] = []

    const addMessages = (msgs: RawSmsMessage[], direction: "in" | "out") => {
      for (const m of msgs) {
        if (seenIds.has(m.ID)) continue
        seenIds.add(m.ID)
        if (isSpam(m.number, m.message)) continue
        const phone = normalizePhone(m.number)
        allMessages.push({
          id: m.ID,
          phone,
          message: decodeHtmlEntities(m.message),
          date: m.deliveredDate,
          direction,
        })
      }
    }

    addMessages(receivedMsgs, "in")
    addMessages(sentMsgs, "out")

    // Group by phone number
    const convMap = new Map<string, typeof allMessages>()
    for (const msg of allMessages) {
      if (!convMap.has(msg.phone)) convMap.set(msg.phone, [])
      convMap.get(msg.phone)!.push(msg)
    }

    // Build conversations sorted by most recent
    const conversations = [...convMap.entries()]
      .map(([phone, msgs]) => {
        msgs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return {
          phoneNumber: phone,
          lastMessage: msgs[0].message.slice(0, 100),
          lastDate: msgs[0].date,
          lastDirection: msgs[0].direction,
          messageCount: msgs.length,
          messages: msgs.slice(0, 100),
        }
      })
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())

    return NextResponse.json({ data: conversations })
  } catch (error) {
    console.error("SMS8 messages error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur SMS8" },
      { status: 500 }
    )
  }
}
