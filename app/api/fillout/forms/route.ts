import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = "https://api.fillout.com/v1/api"

export async function GET() {
  const key = process.env.FILLOUT_API_KEY
  if (!key) {
    return NextResponse.json({ error: "FILLOUT_API_KEY manquante" }, { status: 500 })
  }

  try {
    const res = await fetch(`${API_BASE}/forms`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Fillout API ${res.status}: ${text}`)
    }
    const forms = await res.json()
    return NextResponse.json({ forms, fetchedAt: new Date().toISOString() })
  } catch (error) {
    console.error("Fillout forms error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Fillout" },
      { status: 500 }
    )
  }
}
