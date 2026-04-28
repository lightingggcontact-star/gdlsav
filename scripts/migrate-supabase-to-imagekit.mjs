// One-shot migration: Supabase Storage → ImageKit for stories_videos
// Run: npm run migrate:imagekit
//   (= node --env-file=.env.local scripts/migrate-supabase-to-imagekit.mjs)
//
// Idempotent: skips rows where imagekit_file_id IS NOT NULL.
// Does NOT delete anything from Supabase Storage. Run as many times as needed.

import ImageKit from "imagekit"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IK_PUBLIC = process.env.IMAGEKIT_PUBLIC_KEY
const IK_PRIVATE = process.env.IMAGEKIT_PRIVATE_KEY
const IK_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
if (!IK_PUBLIC || !IK_PRIVATE || !IK_ENDPOINT) {
  console.error("❌ Missing IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const imagekit = new ImageKit({
  publicKey: IK_PUBLIC,
  privateKey: IK_PRIVATE,
  urlEndpoint: IK_ENDPOINT,
})

function fileNameFromUrl(url, fallback = "file") {
  try {
    const u = new URL(url)
    const last = u.pathname.split("/").filter(Boolean).pop()
    return last ? decodeURIComponent(last) : fallback
  } catch {
    return fallback
  }
}

async function downloadAsBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadWithRetry(file, fileName, folder, maxAttempts = 3) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await imagekit.upload({
        file,
        fileName,
        folder,
        useUniqueFileName: true,
      })
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        const wait = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
        console.log(
          `   ⚠️  upload attempt ${attempt}/${maxAttempts} failed (${err.message}). Retry in ${wait}ms`
        )
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr
}

async function main() {
  const { count: total, error: countErr } = await supabase
    .from("stories_videos")
    .select("*", { count: "exact", head: true })

  if (countErr) {
    console.error("❌ Failed to count stories_videos:", countErr.message)
    process.exit(1)
  }

  const { data: pending, error: fetchErr } = await supabase
    .from("stories_videos")
    .select("id, name, video_url, thumbnail_url")
    .is("imagekit_file_id", null)
    .order("created_at", { ascending: true })

  if (fetchErr) {
    console.error("❌ Failed to fetch pending rows:", fetchErr.message)
    process.exit(1)
  }

  const skipped = (total ?? 0) - pending.length
  console.log(`Total stories_videos: ${total ?? 0}`)
  console.log(`Already migrated (skipped): ${skipped}`)
  console.log(`To migrate: ${pending.length}`)
  console.log("")

  if (pending.length === 0) {
    console.log("Nothing to do.")
    return { migrated: 0, failed: 0, skipped }
  }

  let migrated = 0
  let failed = 0

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i]
    const prefix = `[${i + 1}/${pending.length}]`
    console.log(`${prefix} Migrating: ${row.name}`)

    try {
      // Video (mandatory)
      const videoBuffer = await downloadAsBuffer(row.video_url)
      const videoFileName = fileNameFromUrl(row.video_url, "video.mp4")
      const videoUpload = await uploadWithRetry(videoBuffer, videoFileName, "/stories/videos/")

      // Thumbnail (best-effort: keep Supabase URL on failure rather than nulling it)
      let nextThumbnailUrl = row.thumbnail_url
      let nextThumbnailFileId = null
      if (row.thumbnail_url) {
        try {
          const thumbBuffer = await downloadAsBuffer(row.thumbnail_url)
          const thumbFileName = fileNameFromUrl(row.thumbnail_url, "thumb.jpg")
          const thumbUpload = await uploadWithRetry(
            thumbBuffer,
            thumbFileName,
            "/stories/thumbnails/"
          )
          nextThumbnailUrl = thumbUpload.url
          nextThumbnailFileId = thumbUpload.fileId
        } catch (err) {
          console.log(
            `   ⚠️  Thumbnail upload failed: ${err.message} (keeping Supabase thumbnail URL)`
          )
        }
      }

      const { error: updateErr } = await supabase
        .from("stories_videos")
        .update({
          video_url: videoUpload.url,
          thumbnail_url: nextThumbnailUrl,
          imagekit_file_id: videoUpload.fileId,
          imagekit_thumbnail_file_id: nextThumbnailFileId,
        })
        .eq("id", row.id)

      if (updateErr) throw new Error(`DB update: ${updateErr.message}`)

      console.log(`   ✅ OK`)
      migrated++
    } catch (err) {
      console.log(`   ❌ ERREUR: ${err.message}`)
      failed++
    }
  }

  console.log("")
  console.log("─".repeat(50))
  console.log(
    `Migrated: ${migrated} / Failed: ${failed} / Skipped (already migrated): ${skipped}`
  )
  console.log("─".repeat(50))
  return { migrated, failed, skipped }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
