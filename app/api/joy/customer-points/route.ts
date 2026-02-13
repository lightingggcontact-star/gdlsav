import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const JOY_API_BASE = "https://dev-api.joy.so/rest_api/v2"
const JOY_APP_KEY = "D3wl9T2bd5It3dtt8doY"
const JOY_SECRET_KEY = "531758efaf17b25869834890fd4a77a2"

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "email requis" }, { status: 400 })
    }

    const url = new URL(`${JOY_API_BASE}/customers`)
    url.searchParams.set("email", email)
    url.searchParams.set("limit", "1")

    const res = await fetch(url.toString(), {
      headers: {
        "X-Joy-Loyalty-App-Key": JOY_APP_KEY,
        "X-Joy-Loyalty-Secret-Key": JOY_SECRET_KEY,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("Joy API error:", res.status, text)
      return NextResponse.json(
        { error: `Joy API ${res.status}` },
        { status: res.status }
      )
    }

    const json = await res.json()

    if (!json.success) {
      console.error("Joy API failure:", json.error)
      return NextResponse.json(
        { error: json.error?.message || "Joy API error" },
        { status: 400 }
      )
    }

    const customers = Array.isArray(json.data) ? json.data : []

    // Find exact email match
    const customer = customers.find(
      (c: any) => c.email?.toLowerCase() === email.toLowerCase()
    ) ?? null

    if (!customer) {
      return NextResponse.json({ found: false, points: 0, pointsRemain: 0 })
    }

    return NextResponse.json({
      found: true,
      points: customer.point ?? 0,
      totalEarned: customer.totalEarnedPoints ?? 0,
      name: customer.name,
      email: customer.email,
      tier: customer.tierName ?? null,
      referralCode: customer.referralCode ?? null,
      joyId: customer.id,
      shopifyCustomerId: customer.shopifyCustomerId ?? null,
    })
  } catch (error) {
    console.error("Joy customer-points error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Joy" },
      { status: 500 }
    )
  }
}
