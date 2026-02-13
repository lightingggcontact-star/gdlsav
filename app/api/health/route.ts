import { NextResponse } from "next/server"
import { testConnection as testShopify } from "@/lib/shopify"
import { testConnection as testLaPoste } from "@/lib/laposte"

export const dynamic = "force-dynamic"

async function testFillout(): Promise<boolean> {
  try {
    const key = process.env.FILLOUT_API_KEY
    if (!key) return false
    const res = await fetch("https://api.fillout.com/v1/api/forms", {
      headers: { Authorization: `Bearer ${key}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function GET() {
  const [shopify, fillout, laPoste] = await Promise.all([
    testShopify(),
    testFillout(),
    testLaPoste(),
  ])

  return NextResponse.json({ shopify, fillout, laPoste })
}
