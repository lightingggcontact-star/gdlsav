import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Generate signed upload URLs for client-side direct upload to Supabase Storage
// This avoids both RLS issues and Vercel body size limits
export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType, needsThumbnail } = await request.json()

    if (!fileName) {
      return NextResponse.json({ error: "fileName requis" }, { status: 400 })
    }

    const supabase = await createClient()
    const ts = Date.now()
    const safeName = fileName.replace(/[^\w.-]/g, "_")
    const videoPath = `videos/${ts}-${safeName}`

    // Create signed upload URL for video
    const { data: videoUpload, error: videoErr } = await supabase.storage
      .from("stories")
      .createSignedUploadUrl(videoPath)

    if (videoErr) {
      console.error("Signed URL error:", videoErr)
      return NextResponse.json({ error: videoErr.message }, { status: 500 })
    }

    // Create signed upload URL for thumbnail if needed
    let thumbnailUpload = null
    const thumbPath = `thumbnails/${ts}-thumb.jpg`
    if (needsThumbnail) {
      const { data: thumbData, error: thumbErr } = await supabase.storage
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
    const { data: videoPublic } = supabase.storage.from("stories").getPublicUrl(videoPath)
    const { data: thumbPublic } = supabase.storage.from("stories").getPublicUrl(thumbPath)

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
