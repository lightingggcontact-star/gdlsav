import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = "https://api.fillout.com/v1/api"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const key = process.env.FILLOUT_API_KEY
  if (!key) {
    return NextResponse.json({ error: "FILLOUT_API_KEY manquante" }, { status: 500 })
  }

  try {
    const res = await fetch(`${API_BASE}/forms/${formId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Fillout API ${res.status}: ${text}`)
    }
    const form = await res.json()
    return NextResponse.json(form)
  } catch (error) {
    console.error("Fillout form detail error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur Fillout" },
      { status: 500 }
    )
  }
}
