import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    const supabase = await createClient()
    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.emoji !== undefined) updates.emoji = body.emoji
    if (body.thumbnail_url !== undefined) updates.thumbnail_url = body.thumbnail_url
    if (body.display_order !== undefined) updates.display_order = body.display_order

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("stories_videos")
        .update(updates)
        .eq("id", videoId)
      if (error) throw error
    }

    // Remplacer les associations produits si fournies
    if (body.products !== undefined) {
      await supabase
        .from("stories_video_products")
        .delete()
        .eq("video_id", videoId)

      if (body.products.length > 0) {
        const rows = body.products.map((p: { id: string; title: string }, i: number) => ({
          video_id: videoId,
          shopify_product_id: p.id,
          shopify_product_title: p.title,
          display_order: i,
        }))
        await supabase.from("stories_video_products").insert(rows)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Stories video PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    const supabase = await createClient()

    // Recuperer les URLs pour supprimer les fichiers storage
    const { data: video } = await supabase
      .from("stories_videos")
      .select("video_url, thumbnail_url")
      .eq("id", videoId)
      .single()

    // Supprimer de la BDD (cascade sur stories_video_products)
    const { error } = await supabase
      .from("stories_videos")
      .delete()
      .eq("id", videoId)

    if (error) throw error

    // Supprimer les fichiers du storage
    if (video?.video_url) {
      const path = extractStoragePath(video.video_url)
      if (path) await supabase.storage.from("stories").remove([path])
    }
    if (video?.thumbnail_url) {
      const path = extractStoragePath(video.thumbnail_url)
      if (path) await supabase.storage.from("stories").remove([path])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Stories video DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}

function extractStoragePath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/stories\/(.+)$/)
  return match ? match[1] : null
}
