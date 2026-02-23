import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const search = request.nextUrl.searchParams.get("search") ?? ""

    let query = supabase
      .from("game_tokens")
      .select("*")
      .order("created_at", { ascending: false })

    if (search) {
      query = query.or(`email.ilike.%${search}%,customer_name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ tokens: data ?? [] })
  } catch (error) {
    console.error("Game tokens error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { email, customerName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 })
    }

    // Generate unique token
    const token = randomBytes(24).toString("hex")

    // Expires in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from("game_tokens")
      .insert({
        email: email.trim().toLowerCase(),
        customer_name: customerName?.trim() || null,
        token,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      token: data,
      gameUrl: `${process.env.NEXT_PUBLIC_GAME_URL ?? "https://gdl-jeux.vercel.app"}?token=${token}`,
    })
  } catch (error) {
    console.error("Game token create error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
