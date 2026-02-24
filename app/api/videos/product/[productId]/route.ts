import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const dynamic = "force-dynamic"

const ALLOWED_ORIGINS = [
  "https://grainedelascars.com",
  "https://www.grainedelascars.com",
  "https://grainedelascars.myshopify.com",
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const origin = request.headers.get("origin")
  const headers = corsHeaders(origin)

  try {
    const { productId } = await params

    // Client anon (pas de cookies, route publique)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Verifier si les stories sont activees
    const { data: settings } = await supabase
      .from("stories_settings")
      .select("enabled, circle_size, border_color, border_style")
      .single()

    if (!settings?.enabled) {
      return NextResponse.json({ videos: [], settings: null }, { headers })
    }

    // Chercher les videos liees a ce produit
    // productId peut etre numerique ("123456") ou GID ("gid://shopify/Product/123456")
    const { data: links, error } = await supabase
      .from("stories_video_products")
      .select(`
        display_order,
        stories_videos (
          id, name, emoji, video_url, thumbnail_url
        )
      `)
      .or(`shopify_product_id.eq.${productId},shopify_product_id.eq.gid://shopify/Product/${productId}`)
      .order("display_order", { ascending: true })

    if (error) throw error

    const videos = (links ?? [])
      .filter((l: any) => l.stories_videos)
      .map((l: any) => ({
        id: l.stories_videos.id,
        url: l.stories_videos.video_url,
        thumbnail: l.stories_videos.thumbnail_url,
        label: l.stories_videos.name,
        emoji: l.stories_videos.emoji,
        order: l.display_order,
      }))

    return NextResponse.json({ videos, settings }, { headers })
  } catch (error) {
    console.error("Public videos API error:", error)
    return NextResponse.json(
      { videos: [], error: "Erreur serveur" },
      { status: 500, headers }
    )
  }
}
