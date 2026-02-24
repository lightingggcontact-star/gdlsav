import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: videos, error } = await supabase
      .from("stories_videos")
      .select(`
        *,
        stories_video_products (
          id, shopify_product_id, shopify_product_title, display_order
        )
      `)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false })

    if (error) throw error
    return NextResponse.json({ videos: videos ?? [] })
  } catch (error) {
    console.error("Stories videos GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { name, emoji, video_url, thumbnail_url, products } = body

    if (!name || !video_url) {
      return NextResponse.json({ error: "name et video_url requis" }, { status: 400 })
    }

    // Prochain display_order
    const { data: maxRow } = await supabase
      .from("stories_videos")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxRow?.display_order ?? 0) + 1

    const { data: video, error } = await supabase
      .from("stories_videos")
      .insert({
        name,
        emoji: emoji || "🎬",
        video_url,
        thumbnail_url: thumbnail_url || null,
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) throw error

    // Associations produits
    if (products?.length > 0) {
      const productRows = products.map((p: { id: string; title: string }, i: number) => ({
        video_id: video.id,
        shopify_product_id: p.id,
        shopify_product_title: p.title,
        display_order: i,
      }))
      await supabase.from("stories_video_products").insert(productRows)
    }

    return NextResponse.json({ video })
  } catch (error) {
    console.error("Stories videos POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
