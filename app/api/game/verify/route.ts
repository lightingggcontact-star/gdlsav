import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchOrders } from "@/lib/shopify"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const supabase = await createClient()

    // 1. Check if game is enabled
    const { data: settings } = await supabase
      .from("game_settings")
      .select("enabled")
      .single()

    if (settings && !settings.enabled) {
      return NextResponse.json(
        { error: "Le jeu est désactivé pour le moment", code: "GAME_DISABLED" },
        { status: 503 }
      )
    }

    // 2. Check if already played
    const { data: existingPlay } = await supabase
      .from("game_plays")
      .select("id, reward_label, played_at")
      .eq("email", normalizedEmail)
      .single()

    if (existingPlay) {
      return NextResponse.json({
        alreadyPlayed: true,
        rewardLabel: existingPlay.reward_label,
        playedAt: existingPlay.played_at,
      })
    }

    // 3. Verify customer exists on Shopify
    const shopifyOrders = await searchOrders(normalizedEmail)

    if (shopifyOrders.length === 0) {
      return NextResponse.json(
        { error: "Aucune commande trouvée pour cet email. T'es sûr que c'est le bon ?", code: "NO_ORDERS" },
        { status: 404 }
      )
    }

    const customerName = shopifyOrders[0].customerName || "Client"
    const orders = shopifyOrders.slice(0, 3).map((o) => ({
      name: o.name,
      date: o.createdAt,
      total: o.totalPrice,
    }))

    return NextResponse.json({
      email: normalizedEmail,
      customerName,
      orders,
    })
  } catch (error) {
    console.error("Game verify error:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}
