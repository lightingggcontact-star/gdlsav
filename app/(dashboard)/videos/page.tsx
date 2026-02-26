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
  Check,
} from "lucide-react"
import { useSupabase } from "@/lib/supabase/use-supabase"
import type { StoryVideo } from "@/lib/types"

interface ProductTag {
  id: string
  title: string
  status?: string
  imageUrl?: string | null
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
          (data.products ?? []).map((p: any) => ({ id: p.numericId, title: p.title, status: p.status, imageUrl: p.imageUrl }))
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
        status: p.status,
        imageUrl: p.imageUrl,
      }))
      onBulkAdd(products)
    } catch {
      // silent
    } finally {
      setLoadingCollection(false)
    }
  }

  async function handleAllProducts() {
    setCollectionOpen(false)
    setLoadingCollection(true)
    try {
      const res = await fetch("/api/shopify/search-products?all=true")
      const data = await res.json()
      const products: ProductTag[] = (data.products ?? []).map((p: any) => ({
        id: p.numericId,
        title: p.title,
        status: p.status,
        imageUrl: p.imageUrl,
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
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors"
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-secondary">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Video className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <span className="flex-1 text-[13px] truncate">{p.title}</span>
                    {p.status && p.status !== "active" ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                        Non répertorié
                      </span>
                    ) : (
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                        Actif
                      </span>
                    )}
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
              <button
                onClick={handleAllProducts}
                className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#007AFF] hover:bg-secondary transition-colors border-b border-border"
              >
                Tous les produits
              </button>
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
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary pl-1 pr-2 py-1 text-[11px] font-medium"
              >
                <div className="h-5 w-5 shrink-0 overflow-hidden rounded-[4px] bg-background">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Video className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <span className="max-w-[120px] truncate">{p.title}</span>
                {p.status && p.status !== "active" && (
                  <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-700">NR</span>
                )}
                <button onClick={() => onRemove(p.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          {selected.length > 1 && (
            <button
              onClick={() => selected.forEach((p) => onRemove(p.id))}
              className="text-[10px] text-muted-foreground hover:text-[#E51C00] transition-colors"
            >
              Tout retirer ({selected.length})
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
    const timeout = setTimeout(() => {
      reject(new Error("Thumbnail timeout"))
    }, 8000)

    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      // Seek to 0.5s instead of 1s — safer for short videos
      video.currentTime = Math.min(0.5, video.duration || 0.5)
    }

    video.onseeked = () => {
      clearTimeout(timeout)
      const canvas = document.createElement("canvas")
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext("2d")!
      const size = Math.min(video.videoWidth, video.videoHeight)
      const sx = (video.videoWidth - size) / 2
      const sy = (video.videoHeight - size) / 2
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 200, 200)
      const blobUrl = video.src
      video.pause()
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(blobUrl)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error("Canvas to blob failed"))
        },
        "image/jpeg",
        0.8
      )
    }

    video.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("Erreur chargement video"))
    }
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

  // All products for edit dialog
  const [allProducts, setAllProducts] = useState<ProductTag[]>([])
  const [allProductsLoading, setAllProductsLoading] = useState(false)
  const [editFilter, setEditFilter] = useState("")

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
    setEditFilter("")
    setDialogOpen(false)
  }

  function handleFilesSelect(files: FileList | File[]) {
    const valid: File[] = []
    const videoExts = /\.(mp4|mov|webm|avi|mkv|m4v|3gp|ogv)$/i
    let rejected = ""
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/") || videoExts.test(file.name)
      if (!isVideo) {
        rejected = `"${file.name}" n'est pas un fichier vidéo`
        continue
      }
      if (file.size > 50 * 1024 * 1024) {
        rejected = `"${file.name}" dépasse 50 MB (${(file.size / (1024 * 1024)).toFixed(0)} MB)`
        continue
      }
      valid.push(file)
    }
    if (valid.length === 0) {
      if (rejected) alert(rejected)
      return
    }
    setBatchFiles((prev) => [...prev, ...valid])
    if (!dialogOpen) setDialogOpen(true)
  }

  function removeBatchFile(index: number) {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadSingleFile(file: File) {
    // 1. Generate thumbnail client-side
    let thumbnailBlob: Blob | null = null
    try {
      thumbnailBlob = await generateThumbnail(file)
    } catch {
      // Pas grave si thumbnail echoue
    }

    // 2. Get signed upload URLs from server (avoids RLS + Vercel size limit)
    const urlRes = await fetch("/api/stories/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        needsThumbnail: !!thumbnailBlob,
      }),
    })
    if (!urlRes.ok) {
      const err = await urlRes.json().catch(() => ({}))
      throw new Error(err.error || `Signed URL failed (${urlRes.status})`)
    }
    const { video: videoUpload, thumbnail: thumbUpload } = await urlRes.json()

    // 3. Upload video directly to Supabase Storage via signed URL
    const videoRes = await fetch(videoUpload.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!videoRes.ok) throw new Error(`Video upload failed (${videoRes.status})`)

    // 4. Upload thumbnail if available
    let thumbnailUrl = ""
    if (thumbnailBlob && thumbUpload) {
      try {
        const thumbRes = await fetch(thumbUpload.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: thumbnailBlob,
        })
        if (thumbRes.ok) thumbnailUrl = thumbUpload.publicUrl
      } catch {
        // Pas grave
      }
    }

    // 5. Save metadata to database
    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    const saveRes = await fetch("/api/stories/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        emoji: "",
        video_url: videoUpload.publicUrl,
        thumbnail_url: thumbnailUrl,
        products: [],
      }),
    })
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}))
      throw new Error(err.error || `Save failed (${saveRes.status})`)
    }
  }

  async function handleBatchUpload() {
    if (batchFiles.length === 0) return
    setBatchUploading(true)
    setBatchProgress({ current: 0, total: batchFiles.length })

    let errors = 0
    let lastError = ""
    for (let i = 0; i < batchFiles.length; i++) {
      setBatchProgress({ current: i + 1, total: batchFiles.length })
      try {
        await uploadSingleFile(batchFiles[i])
      } catch (err) {
        errors++
        lastError = err instanceof Error ? err.message : String(err)
        console.error(`Upload error for ${batchFiles[i].name}:`, err)
      }
    }

    setBatchUploading(false)
    if (errors > 0) alert(`${errors} vidéo(s) n'ont pas pu être uploadée(s)\n${lastError}`)
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
        let thumbnailBlob: Blob | null = null
        try {
          thumbnailBlob = await generateThumbnail(editFile)
        } catch {
          // Pas grave
        }

        // Get signed upload URLs
        const urlRes = await fetch("/api/stories/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: editFile.name,
            contentType: editFile.type,
            needsThumbnail: !!thumbnailBlob,
          }),
        })
        if (!urlRes.ok) throw new Error("Erreur obtention URL upload")
        const { video: videoUpload, thumbnail: thumbUpload } = await urlRes.json()

        // Upload video directly to Supabase Storage
        const videoRes = await fetch(videoUpload.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": editFile.type },
          body: editFile,
        })
        if (!videoRes.ok) throw new Error("Erreur upload vidéo")
        videoUrl = videoUpload.publicUrl

        // Upload thumbnail
        if (thumbnailBlob && thumbUpload) {
          try {
            const thumbRes = await fetch(thumbUpload.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/jpeg" },
              body: thumbnailBlob,
            })
            if (thumbRes.ok) thumbnailUrl = thumbUpload.publicUrl
          } catch { /* Pas grave */ }
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

  async function fetchAllProducts() {
    if (allProducts.length > 0) return
    setAllProductsLoading(true)
    try {
      const res = await fetch("/api/shopify/search-products?all=true")
      const data = await res.json()
      setAllProducts(
        (data.products ?? []).map((p: any) => ({
          id: p.numericId,
          title: p.title,
          status: p.status,
          imageUrl: p.imageUrl,
        }))
      )
    } catch {
      // silent
    } finally {
      setAllProductsLoading(false)
    }
  }

  function handleEdit(video: StoryVideo) {
    setEditingVideo(video)
    setUploadName(video.name)
    setEditFile(null)
    setEditPreview(video.thumbnail_url)
    setEditFilter("")
    setUploadProducts(
      video.stories_video_products.map((p) => ({
        id: p.shopify_product_id,
        title: p.shopify_product_title ?? p.shopify_product_id,
      }))
    )
    setBatchFiles([])
    setDialogOpen(true)
    fetchAllProducts()
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
      {dialogOpen && editingVideo && (() => {
        const selectedIds = new Set(uploadProducts.map((p) => p.id))
        const filterLower = editFilter.toLowerCase()
        const filtered = allProducts.filter((p) =>
          !filterLower || p.title.toLowerCase().includes(filterLower)
        )
        // Sort: selected first, then alphabetical
        const sorted = [...filtered].sort((a, b) => {
          const aSelected = selectedIds.has(a.id) ? 0 : 1
          const bSelected = selectedIds.has(b.id) ? 0 : 1
          if (aSelected !== bSelected) return aSelected - bSelected
          return a.title.localeCompare(b.title)
        })

        function toggleProduct(p: ProductTag) {
          if (selectedIds.has(p.id)) {
            setUploadProducts((prev) => prev.filter((x) => x.id !== p.id))
          } else {
            setUploadProducts((prev) => [...prev, p])
          }
        }

        function toggleAll() {
          if (filtered.every((p) => selectedIds.has(p.id))) {
            // Deselect all filtered
            const filterIds = new Set(filtered.map((p) => p.id))
            setUploadProducts((prev) => prev.filter((p) => !filterIds.has(p.id)))
          } else {
            // Select all filtered
            setUploadProducts((prev) => {
              const ids = new Set(prev.map((p) => p.id))
              return [...prev, ...filtered.filter((p) => !ids.has(p.id))]
            })
          }
        }

        const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))

        return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => resetDialog()}>
          <div
            className="flex w-full sm:max-w-lg flex-col rounded-t-2xl sm:rounded-xl border border-border bg-card shadow-xl max-h-[95vh] sm:max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5 shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">Modifier la vidéo</h3>
              <button onClick={resetDialog} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
              {/* Preview vidéo + nom */}
              <div className="flex items-start gap-4 border-b border-border px-5 py-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-purple-500/60 bg-secondary shadow-sm">
                  {editPreview ? (
                    <img src={editPreview} className="h-full w-full object-cover" alt="preview" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Nom d&apos;affichage</label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Ex: Amnésia Hydro"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] font-medium outline-none focus:border-[#007AFF] transition-colors"
                  />
                </div>
              </div>

              {/* Produits */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Produits associés
                  </label>
                  <span className="rounded-full bg-[#007AFF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#007AFF]">
                    {uploadProducts.length} sélectionné{uploadProducts.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Search + select all */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={editFilter}
                      onChange={(e) => setEditFilter(e.target.value)}
                      placeholder="Filtrer les produits..."
                      className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#007AFF]"
                    />
                  </div>
                  <button
                    onClick={toggleAll}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${
                      allFilteredSelected
                        ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {allFilteredSelected ? "Tout désélect." : "Tout sélect."}
                  </button>
                </div>
              </div>

              {/* Product list */}
              <div className="px-5 pb-4">
                {allProductsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-[12px] text-muted-foreground">Chargement des produits...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sorted.map((p) => {
                      const isSelected = selectedIds.has(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleProduct(p)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? "bg-[#007AFF]/5 border border-[#007AFF]/20"
                              : "hover:bg-secondary border border-transparent"
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                            isSelected
                              ? "border-[#007AFF] bg-[#007AFF]"
                              : "border-border"
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>

                          {/* Product image */}
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <Video className="h-4 w-4" />
                              </div>
                            )}
                          </div>

                          {/* Title + status */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate">{p.title}</p>
                          </div>

                          {/* Status */}
                          {p.status && p.status !== "active" ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-700">
                              Non répertorié
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
                              Actif
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {filtered.length === 0 && !allProductsLoading && (
                      <p className="py-6 text-center text-[12px] text-muted-foreground">
                        {editFilter ? "Aucun produit trouvé" : "Aucun produit"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer sticky */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3.5 shrink-0 bg-card rounded-b-xl">
              <button
                onClick={resetDialog}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleEditSave}
                disabled={uploading || !uploadName}
                className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
