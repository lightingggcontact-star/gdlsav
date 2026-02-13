import { NextResponse, type NextRequest } from "next/server"
import { fetchCustomerByPhone } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone")

    if (!phone) {
      return NextResponse.json({ error: "phone requis" }, { status: 400 })
    }

    const data = await fetchCustomerByPhone(phone)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Customer by phone error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Shopify" },
      { status: 500 }
    )
  }
}
