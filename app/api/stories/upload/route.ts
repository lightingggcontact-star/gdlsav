import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getStorageClient() {
  // Use service role key if available (bypasses RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    return createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType, needsThumbnail } = await request.json()

    if (!fileName) {
      return NextResponse.json({ error: "fileName requis" }, { status: 400 })
    }

    // Prefer admin client (service role) for storage — bypasses RLS
    // Fall back to user client if service role not configured
    const adminClient = getStorageClient()
    const userClient = await createClient()
    const storageClient = adminClient || userClient

    const ts = Date.now()
    const safeName = fileName.replace(/[^\w.-]/g, "_")
    const videoPath = `videos/${ts}-${safeName}`

    // Create signed upload URL for video
    const { data: videoUpload, error: videoErr } = await storageClient.storage
      .from("stories")
      .createSignedUploadUrl(videoPath)

    if (videoErr) {
      console.error("Signed URL error:", videoErr)

      // If RLS blocks, return helpful message
      if (videoErr.message?.includes("security") || videoErr.message?.includes("policy") || videoErr.message?.includes("row-level")) {
        return NextResponse.json({
          error: "Storage RLS bloque l'upload. Ajoute SUPABASE_SERVICE_ROLE_KEY dans les env vars ou configure les policies du bucket 'stories'.",
        }, { status: 500 })
      }

      return NextResponse.json({ error: videoErr.message }, { status: 500 })
    }

    // Create signed upload URL for thumbnail if needed
    let thumbnailUpload = null
    const thumbPath = `thumbnails/${ts}-thumb.jpg`
    if (needsThumbnail) {
      const { data: thumbData, error: thumbErr } = await storageClient.storage
        .from("stories")
        .createSignedUploadUrl(thumbPath)
      if (!thumbErr && thumbData) {
        thumbnailUpload = {
          signedUrl: thumbData.signedUrl,
          token: thumbData.token,
          path: thumbPath,
        }
      }
    }

    // Get public URLs
    const { data: videoPublic } = storageClient.storage.from("stories").getPublicUrl(videoPath)
    const { data: thumbPublic } = storageClient.storage.from("stories").getPublicUrl(thumbPath)

    return NextResponse.json({
      video: {
        signedUrl: videoUpload.signedUrl,
        token: videoUpload.token,
        path: videoPath,
        publicUrl: videoPublic.publicUrl,
      },
      thumbnail: thumbnailUpload ? {
        ...thumbnailUpload,
        publicUrl: thumbPublic.publicUrl,
      } : null,
    })
  } catch (error) {
    console.error("Upload URL generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    )
  }
}
