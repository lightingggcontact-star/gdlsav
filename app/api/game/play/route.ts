import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface RewardDef {
  key: string
  label: string
  probability: number
  type: string
  value: number | null
}

function pickWeightedReward(rewards: RewardDef[]): RewardDef {
  const totalWeight = rewards.reduce((sum, r) => sum + r.probability, 0)
  let random = Math.random() * totalWeight
  for (const reward of rewards) {
    random -= reward.probability
    if (random <= 0) return reward
  }
  return rewards[rewards.length - 1]
}

export async function POST(request: NextRequest) {
  try {
    const { email, customerName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email manquant" }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const supabase = await createClient()

    // 1. Check if already played
    const { data: existingPlay } = await supabase
      .from("game_plays")
      .select("id, reward_label")
      .eq("email", normalizedEmail)
      .single()

    if (existingPlay) {
      return NextResponse.json(
        { error: "Déjà joué", reward: { label: existingPlay.reward_label } },
        { status: 409 }
      )
    }

    // 2. Load rewards from game_settings
    const { data: settings } = await supabase
      .from("game_settings")
      .select("rewards, enabled")
      .single()

    if (!settings?.enabled) {
      return NextResponse.json(
        { error: "Le jeu est désactivé pour le moment" },
        { status: 503 }
      )
    }

    const rewards: RewardDef[] = settings.rewards ?? []
    if (rewards.length === 0) {
      return NextResponse.json(
        { error: "Aucune récompense configurée" },
        { status: 500 }
      )
    }

    // 3. Pick a reward
    const reward = pickWeightedReward(rewards)

    // 4. Save the play (UNIQUE on email = ultimate protection)
    const { error: insertError } = await supabase
      .from("game_plays")
      .insert({
        email: normalizedEmail,
        customer_name: customerName || null,
        reward_key: reward.key,
        reward_label: reward.label,
      })

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Déjà joué" },
          { status: 409 }
        )
      }
      throw insertError
    }

    return NextResponse.json({
      reward: {
        key: reward.key,
        label: reward.label,
        type: reward.type,
      },
    })
  } catch (error) {
    console.error("Game play error:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}
