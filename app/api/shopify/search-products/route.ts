import { NextResponse, type NextRequest } from "next/server"
import { searchProducts, listCollections, getCollectionProducts, getAllProducts } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // List collections
    const collections = request.nextUrl.searchParams.get("collections")
    if (collections === "true") {
      const result = await listCollections()
      return NextResponse.json({ collections: result })
    }

    // All products
    const all = request.nextUrl.searchParams.get("all")
    if (all === "true") {
      const products = await getAllProducts()
      return NextResponse.json({ products })
    }

    // Get products from a collection
    const collectionId = request.nextUrl.searchParams.get("collection")
    if (collectionId) {
      const gid = `gid://shopify/Collection/${collectionId}`
      const products = await getCollectionProducts(gid)
      return NextResponse.json({ products })
    }

    // Search products
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
