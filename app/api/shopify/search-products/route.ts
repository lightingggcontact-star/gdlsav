import { NextResponse, type NextRequest } from "next/server"
import { searchProducts } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ products: [] })
    }

    const products = await searchProducts(q.trim())
    return NextResponse.json({ products })
  } catch (error) {
    console.error("Search products error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Shopify" },
      { status: 500 }
    )
  }
}
