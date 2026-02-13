import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const JOY_API_BASE = "https://dev-api.joy.so/rest_api/v2"
const JOY_APP_KEY = "D3wl9T2bd5It3dtt8doY"
const JOY_SECRET_KEY = "531758efaf17b25869834890fd4a77a2"

const JOY_HEADERS = {
  "X-Joy-Loyalty-App-Key": JOY_APP_KEY,
  "X-Joy-Loyalty-Secret-Key": JOY_SECRET_KEY,
  "Content-Type": "application/json",
}

async function joyPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${JOY_API_BASE}${endpoint}`, {
    method: "POST",
    headers: JOY_HEADERS,
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    const msg = json.error?.message || `Joy API ${res.status}`
    throw new Error(msg)
  }
  return json
}

async function joyGet(endpoint: string) {
  const res = await fetch(`${JOY_API_BASE}${endpoint}`, { headers: JOY_HEADERS })
  const json = await res.json()
  if (!res.ok || !json.success) {
    const msg = json.error?.message || `Joy API ${res.status}`
    throw new Error(msg)
  }
  return json
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, shopifyCustomerId, points, adminNote, programId } = body as {
      action: string
      shopifyCustomerId: string | number
      points?: number
      adminNote?: string
      programId?: string
    }

    if (!shopifyCustomerId) {
      return NextResponse.json({ error: "shopifyCustomerId requis" }, { status: 400 })
    }

    const custId = String(shopifyCustomerId)

    switch (action) {
      case "award": {
        if (!points || points <= 0) {
          return NextResponse.json({ error: "points requis (> 0)" }, { status: 400 })
        }
        const result = await joyPost("/transactions/points/award", {
          shopifyCustomerId: custId,
          point: points,
          adminNote: adminNote || `Points ajoutés via GDL SAV`,
        })
        return NextResponse.json({ success: true, data: result.data })
      }

      case "adjust": {
        if (!points) {
          return NextResponse.json({ error: "points requis" }, { status: 400 })
        }
        const result = await joyPost("/transactions/points/adjust", {
          shopifyCustomerId: custId,
          point: points,
          adminNote: adminNote || `Ajustement points via GDL SAV`,
        })
        return NextResponse.json({ success: true, data: result.data })
      }

      case "redeem": {
        if (!programId) {
          return NextResponse.json({ error: "programId requis" }, { status: 400 })
        }
        const result = await joyPost("/programs/redemption/redeem", {
          programId,
          shopifyCustomerId: custId,
          quantity: 1,
        })
        return NextResponse.json({ success: true, data: result.data })
      }

      case "get-redemption-programs": {
        const result = await joyGet("/programs/redemption")
        return NextResponse.json({ success: true, programs: result.data })
      }

      case "get-expired": {
        const result = await joyGet(`/transactions?shopifyCustomerId=${custId}&limit=50`)
        const transactions = Array.isArray(result.data) ? result.data : []
        // Find all expire_point transactions, sorted by most recent
        const expired = transactions
          .filter((t: { type: string }) => t.type === "expire_point")
          .sort((a: { createdAt: string }, b: { createdAt: string }) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        if (expired.length === 0) {
          return NextResponse.json({ success: true, found: false, expiredPoints: 0 })
        }
        const last = expired[0] as { oldPoint: number; newPoint: number; createdAt: string }
        const expiredPoints = last.oldPoint - last.newPoint
        return NextResponse.json({
          success: true,
          found: true,
          expiredPoints,
          expiredDate: last.createdAt,
          oldPoint: last.oldPoint,
          newPoint: last.newPoint,
        })
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error("Joy action error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Joy" },
      { status: 500 }
    )
  }
}
