"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Reorder } from "framer-motion"
import Link from "next/link"
import {
  Video,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  Upload,
  X,
  Search,
  Loader2,
} from "lucide-react"
import { useSupabase } from "@/lib/supabase/use-supabase"
import type { StoryVideo } from "@/lib/types"

interface ProductTag {
  id: string
  title: string
}

// ─── Product Search Input ───

function ProductSearchInput({
  selected,
  onAdd,
  onRemove,
}: {
  selected: ProductTag[]
  onAdd: (p: ProductTag) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductTag[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setSearching(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/shopify/search-products?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(
          (data.products ?? []).map((p: any) => ({ id: p.numericId, title: p.title }))
        )
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Chercher un produit Shopify..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#007AFF]"
        />
        {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {results
              .filter((r) => !selected.some((s) => s.id === r.id))
              .map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => {
                    onAdd(p)
                    setQuery("")
                    setOpen(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-secondary transition-colors"
                >
                  {p.title}
                </button>
              ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium"
            >
              {p.title}
              <button onClick={() => onRemove(p.id)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Thumbnail Generator ───

function generateThumbnail(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      video.currentTime = 1
    }

    video.onseeked = () => {
      const canvas = document.createElement("canvas")
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext("2d")!
      const size = Math.min(video.videoWidth, video.videoHeight)
      const sx = (video.videoWidth - size) / 2
      const sy = (video.videoHeight - size) / 2
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 200, 200)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error("Canvas to blob failed"))
        },
        "image/jpeg",
        0.8
      )
      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => reject(new Error("Erreur chargement video"))
    video.src = URL.createObjectURL(videoFile)
  })
}

// ─── Sub Nav ───

function SubNav() {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      <Link
        href="/videos"
        className="rounded-md bg-card px-3 py-1.5 text-[12px] font-medium shadow-sm"
      >
        Bibliothèque
      </Link>
      <Link
        href="/videos/produits"
        className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Par produit
      </Link>
      <Link
        href="/videos/reglages"
        className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Réglages
      </Link>
    </div>
  )
}

// ─── Main Page ───

export default function VideosPage() {
  const supabase = useSupabase()
  const [videos, setVideos] = useState<StoryVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<StoryVideo | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState("")
  const [uploadEmoji, setUploadEmoji] = useState("🎬")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProducts, setUploadProducts] = useState<ProductTag[]>([])
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/stories/videos")
      if (res.ok) {
        const data = await res.json()
        setVideos(data.videos ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  function resetDialog() {
    setUploadName("")
    setUploadEmoji("🎬")
    setUploadFile(null)
    setUploadProducts([])
    setUploadPreview(null)
    setEditingVideo(null)
    setDialogOpen(false)
  }

  function handleFileSelect(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      alert("Fichier trop lourd (max 50 MB)")
      return
    }
    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))
    }
  }

  async function handleUpload() {
    if (!uploadFile && !editingVideo) return
    setUploading(true)

    try {
      let videoUrl = editingVideo?.video_url ?? ""
      let thumbnailUrl = editingVideo?.thumbnail_url ?? ""

      // Upload nouveau fichier si fourni
      if (uploadFile) {
        const ts = Date.now()
        const safeName = uploadFile.name.replace(/[^\w.-]/g, '_')
        const videoPath = `videos/${ts}-${safeName}`
        const { error: uploadErr } = await supabase.storage
          .from("stories")
          .upload(videoPath, uploadFile, { cacheControl: "3600", contentType: uploadFile.type })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage.from("stories").getPublicUrl(videoPath)
        videoUrl = urlData.publicUrl

        // Generer thumbnail
        try {
          const thumbBlob = await generateThumbnail(uploadFile)
          const thumbPath = `thumbnails/${ts}-thumb.jpg`
          await supabase.storage
            .from("stories")
            .upload(thumbPath, thumbBlob, { cacheControl: "3600", contentType: "image/jpeg" })
          const { data: thumbUrlData } = supabase.storage.from("stories").getPublicUrl(thumbPath)
          thumbnailUrl = thumbUrlData.publicUrl
        } catch {
          // Pas grave si thumbnail echoue
        }
      }

      const payload = {
        name: uploadName,
        emoji: uploadEmoji,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        products: uploadProducts.map((p) => ({ id: p.id, title: p.title })),
      }

      if (editingVideo) {
        await fetch(`/api/stories/videos/${editingVideo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch("/api/stories/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      resetDialog()
      fetchVideos()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur upload")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette vidéo ?")) return
    await fetch(`/api/stories/videos/${id}`, { method: "DELETE" })
    fetchVideos()
  }

  function handleEdit(video: StoryVideo) {
    setEditingVideo(video)
    setUploadName(video.name)
    setUploadEmoji(video.emoji)
    setUploadFile(null)
    setUploadPreview(video.thumbnail_url)
    setUploadProducts(
      video.stories_video_products.map((p) => ({
        id: p.shopify_product_id,
        title: p.shopify_product_title ?? p.shopify_product_id,
      }))
    )
    setDialogOpen(true)
  }

  async function handleReorder(newOrder: StoryVideo[]) {
    setVideos(newOrder)
    await fetch("/api/stories/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: newOrder.map((v) => v.id) }),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Video Stories</h1>
          <p className="text-[13px] text-muted-foreground">
            Gérez les vidéos affichées sur les pages produit
          </p>
        </div>
        <button
          onClick={() => { resetDialog(); setDialogOpen(true) }}
          className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD]"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      <SubNav />

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && videos.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-16">
          <Video className="h-8 w-8 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">Aucune vidéo. Clique sur Ajouter pour commencer.</p>
        </div>
      )}

      {/* Video List */}
      {!loading && videos.length > 0 && (
        <Reorder.Group
          axis="y"
          values={videos}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {videos.map((video) => (
            <Reorder.Item
              key={video.id}
              value={video}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[0_1px_0_0_rgba(0,0,0,.05)] cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

              {/* Thumbnail */}
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-purple-500/50 bg-secondary">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">
                    {video.emoji}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {video.emoji} {video.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {video.stories_video_products.map((p) => (
                    <span
                      key={p.id}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {p.shopify_product_title ?? p.shopify_product_id}
                    </span>
                  ))}
                  {video.stories_video_products.length === 0 && (
                    <span className="text-[10px] text-muted-foreground italic">Aucun produit</span>
                  )}
                </div>
              </div>

              {/* Date */}
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                {new Date(video.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(video)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(video.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-[#FEE8EB] hover:text-[#E51C00] transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Upload/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => resetDialog()}>
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">
                {editingVideo ? "Modifier la vidéo" : "Ajouter une vidéo"}
              </h3>
              <button onClick={resetDialog} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Drop zone */}
              {!editingVideo && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file?.type.startsWith("video/")) handleFileSelect(file)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${
                    dragOver ? "border-[#007AFF] bg-[#EAF3FF]" : "border-border hover:border-[#007AFF]/50"
                  }`}
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-[12px] text-muted-foreground">
                    {uploadFile ? uploadFile.name : "Glisse une vidéo ici ou clique pour parcourir"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Max 50 MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                  />
                </div>
              )}

              {/* Preview thumbnail */}
              {uploadPreview && (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-purple-500 bg-secondary">
                    {uploadFile ? (
                      <video
                        src={uploadPreview}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={uploadPreview}
                        className="h-full w-full object-cover"
                        alt="preview"
                      />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Preview thumbnail</span>
                </div>
              )}

              {/* Nom */}
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">Nom</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Ex: Amnésia Hydro"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-[#007AFF]"
                />
              </div>

              {/* Emoji */}
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">Emoji</label>
                <input
                  type="text"
                  value={uploadEmoji}
                  onChange={(e) => setUploadEmoji(e.target.value)}
                  className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-center text-[16px] outline-none focus:border-[#007AFF]"
                />
              </div>

              {/* Produits */}
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">
                  Produits associés
                </label>
                <ProductSearchInput
                  selected={uploadProducts}
                  onAdd={(p) => setUploadProducts((prev) => [...prev, p])}
                  onRemove={(id) => setUploadProducts((prev) => prev.filter((p) => p.id !== id))}
                />
              </div>

              {/* Boutons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetDialog}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || (!uploadFile && !editingVideo) || !uploadName}
                  className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? "Upload..." : editingVideo ? "Sauvegarder" : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
