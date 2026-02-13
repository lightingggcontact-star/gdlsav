import { NextResponse, type NextRequest } from "next/server"
import { fetchOrdersByEmail } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "email requis" }, { status: 400 })
    }

    const data = await fetchOrdersByEmail(email)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Customer orders error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Shopify" },
      { status: 500 }
    )
  }
}
