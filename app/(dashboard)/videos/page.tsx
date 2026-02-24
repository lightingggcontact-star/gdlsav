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
  ChevronDown,
} from "lucide-react"
import { useSupabase } from "@/lib/supabase/use-supabase"
import type { StoryVideo } from "@/lib/types"

interface ProductTag {
  id: string
  title: string
}

// ─── Product Search Input ───

interface CollectionItem {
  id: string
  numericId: string
  title: string
  productsCount: number
}

function ProductSearchInput({
  selected,
  onAdd,
  onRemove,
  onBulkAdd,
}: {
  selected: ProductTag[]
  onAdd: (p: ProductTag) => void
  onRemove: (id: string) => void
  onBulkAdd: (products: ProductTag[]) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductTag[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  // Collection picker
  const [collections, setCollections] = useState<CollectionItem[]>([])
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [loadingCollection, setLoadingCollection] = useState(false)

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

  async function handleOpenCollections() {
    if (collections.length > 0) {
      setCollectionOpen(!collectionOpen)
      return
    }
    setLoadingCollection(true)
    try {
      const res = await fetch("/api/shopify/search-products?collections=true")
      const data = await res.json()
      setCollections(data.collections ?? [])
      setCollectionOpen(true)
    } catch {
      // silent
    } finally {
      setLoadingCollection(false)
    }
  }

  async function handlePickCollection(col: CollectionItem) {
    setCollectionOpen(false)
    setLoadingCollection(true)
    try {
      const res = await fetch(`/api/shopify/search-products?collection=${col.numericId}`)
      const data = await res.json()
      const products: ProductTag[] = (data.products ?? []).map((p: any) => ({
        id: p.numericId,
        title: p.title,
      }))
      onBulkAdd(products)
    } catch {
      // silent
    } finally {
      setLoadingCollection(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Chercher un produit..."
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
        <div className="relative">
          <button
            onClick={handleOpenCollections}
            disabled={loadingCollection}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {loadingCollection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
              <>Collection <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
          {collectionOpen && collections.length > 0 && (
            <div className="absolute top-full right-0 z-50 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {collections.map((col) => (
                <button
                  key={col.numericId}
                  onClick={() => handlePickCollection(col)}
                  className="block w-full px-3 py-2 text-left text-[12px] hover:bg-secondary transition-colors"
                >
                  <span className="font-medium">{col.title}</span>
                  <span className="ml-1 text-muted-foreground">({col.productsCount})</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
          {selected.length > 1 && (
            <button
              onClick={() => selected.forEach((p) => onRemove(p.id))}
              className="text-[10px] text-muted-foreground hover:text-[#E51C00] transition-colors"
            >
              Tout retirer
            </button>
          )}
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

  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit state (single video)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState("")
  const [uploadProducts, setUploadProducts] = useState<ProductTag[]>([])
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editPreview, setEditPreview] = useState<string | null>(null)

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
    setUploadProducts([])
    setEditFile(null)
    setEditPreview(null)
    setEditingVideo(null)
    setBatchFiles([])
    setBatchProgress(null)
    setDialogOpen(false)
  }

  function handleFilesSelect(files: FileList | File[]) {
    const valid: File[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) continue
      if (file.size > 50 * 1024 * 1024) continue
      valid.push(file)
    }
    if (valid.length === 0) return
    setBatchFiles((prev) => [...prev, ...valid])
    if (!dialogOpen) setDialogOpen(true)
  }

  function removeBatchFile(index: number) {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadSingleFile(file: File) {
    const ts = Date.now()
    const safeName = file.name.replace(/[^\w.-]/g, "_")
    const videoPath = `videos/${ts}-${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from("stories")
      .upload(videoPath, file, { cacheControl: "3600", contentType: file.type })
    if (uploadErr) throw uploadErr

    const { data: urlData } = supabase.storage.from("stories").getPublicUrl(videoPath)
    const videoUrl = urlData.publicUrl

    let thumbnailUrl = ""
    try {
      const thumbBlob = await generateThumbnail(file)
      const thumbPath = `thumbnails/${ts}-thumb.jpg`
      await supabase.storage
        .from("stories")
        .upload(thumbPath, thumbBlob, { cacheControl: "3600", contentType: "image/jpeg" })
      const { data: thumbUrlData } = supabase.storage.from("stories").getPublicUrl(thumbPath)
      thumbnailUrl = thumbUrlData.publicUrl
    } catch {
      // Pas grave si thumbnail echoue
    }

    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")

    await fetch("/api/stories/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        emoji: "",
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        products: [],
      }),
    })
  }

  async function handleBatchUpload() {
    if (batchFiles.length === 0) return
    setBatchUploading(true)
    setBatchProgress({ current: 0, total: batchFiles.length })

    let errors = 0
    for (let i = 0; i < batchFiles.length; i++) {
      setBatchProgress({ current: i + 1, total: batchFiles.length })
      try {
        await uploadSingleFile(batchFiles[i])
      } catch {
        errors++
      }
    }

    setBatchUploading(false)
    if (errors > 0) alert(`${errors} vidéo(s) n'ont pas pu être uploadée(s)`)
    resetDialog()
    fetchVideos()
  }

  async function handleEditSave() {
    if (!editingVideo) return
    setUploading(true)

    try {
      let videoUrl = editingVideo.video_url
      let thumbnailUrl = editingVideo.thumbnail_url ?? ""

      if (editFile) {
        const ts = Date.now()
        const safeName = editFile.name.replace(/[^\w.-]/g, "_")
        const videoPath = `videos/${ts}-${safeName}`
        const { error: uploadErr } = await supabase.storage
          .from("stories")
          .upload(videoPath, editFile, { cacheControl: "3600", contentType: editFile.type })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage.from("stories").getPublicUrl(videoPath)
        videoUrl = urlData.publicUrl

        try {
          const thumbBlob = await generateThumbnail(editFile)
          const thumbPath = `thumbnails/${ts}-thumb.jpg`
          await supabase.storage
            .from("stories")
            .upload(thumbPath, thumbBlob, { cacheControl: "3600", contentType: "image/jpeg" })
          const { data: thumbUrlData } = supabase.storage.from("stories").getPublicUrl(thumbPath)
          thumbnailUrl = thumbUrlData.publicUrl
        } catch {
          // Pas grave
        }
      }

      await fetch(`/api/stories/videos/${editingVideo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName,
          emoji: "",
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          products: uploadProducts.map((p) => ({ id: p.id, title: p.title })),
        }),
      })

      resetDialog()
      fetchVideos()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur sauvegarde")
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
    setEditFile(null)
    setEditPreview(video.thumbnail_url)
    setUploadProducts(
      video.stories_video_products.map((p) => ({
        id: p.shopify_product_id,
        title: p.shopify_product_title ?? p.shopify_product_id,
      }))
    )
    setBatchFiles([])
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
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {video.name}
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

      {/* Batch Upload Dialog */}
      {dialogOpen && !editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !batchUploading && resetDialog()}>
          <div
            className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">
                Ajouter des vidéos
              </h3>
              {!batchUploading && (
                <button onClick={resetDialog} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  handleFilesSelect(e.dataTransfer.files)
                }}
                onClick={() => !batchUploading && fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOver ? "border-[#007AFF] bg-[#EAF3FF]" : "border-border hover:border-[#007AFF]/50"
                } ${batchUploading ? "pointer-events-none opacity-50" : ""}`}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-[12px] text-muted-foreground">
                  Glisse tes vidéos ici ou clique pour parcourir
                </p>
                <p className="text-[10px] text-muted-foreground">Plusieurs fichiers possibles · Max 50 MB / vidéo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelect(e.target.files)
                    e.target.value = ""
                  }}
                />
              </div>

              {/* File list */}
              {batchFiles.length > 0 && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {batchFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">
                          {file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      {batchProgress && batchProgress.current > i ? (
                        <span className="text-[11px] text-green-600 font-medium">✓</span>
                      ) : batchProgress && batchProgress.current === i ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                      ) : !batchUploading ? (
                        <button
                          onClick={() => removeBatchFile(i)}
                          className="text-muted-foreground hover:text-[#E51C00] transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* Progress bar */}
              {batchProgress && (
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-[#007AFF] transition-all duration-300 rounded-full"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {batchProgress.current} / {batchProgress.total} vidéo{batchProgress.total > 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* Boutons */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[12px] text-muted-foreground">
                  {batchFiles.length} vidéo{batchFiles.length > 1 ? "s" : ""} sélectionnée{batchFiles.length > 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  {!batchUploading && (
                    <button
                      onClick={resetDialog}
                      className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={handleBatchUpload}
                    disabled={batchUploading || batchFiles.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
                  >
                    {batchUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {batchUploading ? "Upload en cours..." : `Uploader ${batchFiles.length > 0 ? `(${batchFiles.length})` : ""}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {dialogOpen && editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => resetDialog()}>
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Modifier la vidéo</h3>
              <button onClick={resetDialog} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Preview thumbnail */}
              {editPreview && (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-purple-500 bg-secondary">
                    <img src={editPreview} className="h-full w-full object-cover" alt="preview" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">Thumbnail actuelle</span>
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

              {/* Produits */}
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">
                  Produits associés
                </label>
                <ProductSearchInput
                  selected={uploadProducts}
                  onAdd={(p) => setUploadProducts((prev) => [...prev, p])}
                  onRemove={(id) => setUploadProducts((prev) => prev.filter((p) => p.id !== id))}
                  onBulkAdd={(products) => {
                    setUploadProducts((prev) => {
                      const ids = new Set(prev.map((p) => p.id))
                      return [...prev, ...products.filter((p) => !ids.has(p.id))]
                    })
                  }}
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
                  onClick={handleEditSave}
                  disabled={uploading || !uploadName}
                  className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
