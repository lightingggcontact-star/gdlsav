import { NextResponse, type NextRequest } from "next/server"
import { fetchCustomersByPhones } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phones: string[] = body.phones

    if (!Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ error: "phones array requis" }, { status: 400 })
    }

    const data = await fetchCustomersByPhones(phones)
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Customers batch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Shopify" },
      { status: 500 }
    )
  }
}
