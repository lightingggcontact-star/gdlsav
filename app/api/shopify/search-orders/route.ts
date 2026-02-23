import { NextResponse, type NextRequest } from "next/server"
import { searchOrders } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ orders: [] })
    }

    const orders = await searchOrders(q.trim())
    return NextResponse.json({ orders })
  } catch (error) {
    console.error("Search orders error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Shopify" },
      { status: 500 }
    )
  }
}
