"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Package, Search, Plus, X, Video } from "lucide-react"
import type { StoryVideo } from "@/lib/types"

interface ProductGroup {
  shopifyProductId: string
  shopifyProductTitle: string
  videos: { id: string; name: string; emoji: string; thumbnailUrl: string | null }[]
}

function SubNav() {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      <Link
        href="/videos"
        className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Bibliothèque
      </Link>
      <Link
        href="/videos/produits"
        className="rounded-md bg-card px-3 py-1.5 text-[12px] font-medium shadow-sm"
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

export default function ProduitsPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [allVideos, setAllVideos] = useState<StoryVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Dialog pour ajouter une video a un produit
  const [addDialogProduct, setAddDialogProduct] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/stories/videos")
      if (!res.ok) return
      const data = await res.json()
      const videos: StoryVideo[] = data.videos ?? []
      setAllVideos(videos)

      // Grouper par produit
      const map = new Map<string, ProductGroup>()
      for (const video of videos) {
        for (const p of video.stories_video_products) {
          const key = p.shopify_product_id
          if (!map.has(key)) {
            map.set(key, {
              shopifyProductId: key,
              shopifyProductTitle: p.shopify_product_title ?? key,
              videos: [],
            })
          }
          map.get(key)!.videos.push({
            id: video.id,
            name: video.name,
            emoji: video.emoji,
            thumbnailUrl: video.thumbnail_url,
          })
        }
      }
      setGroups(Array.from(map.values()))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleRemoveVideoFromProduct(videoId: string, productId: string) {
    // Recuperer la video, retirer le produit, PUT update
    const video = allVideos.find((v) => v.id === videoId)
    if (!video) return

    const updatedProducts = video.stories_video_products
      .filter((p) => p.shopify_product_id !== productId)
      .map((p) => ({ id: p.shopify_product_id, title: p.shopify_product_title ?? "" }))

    await fetch(`/api/stories/videos/${videoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: updatedProducts }),
    })
    fetchData()
  }

  async function handleAddVideoToProduct(videoId: string, productId: string, productTitle: string) {
    const video = allVideos.find((v) => v.id === videoId)
    if (!video) return

    const currentProducts = video.stories_video_products.map((p) => ({
      id: p.shopify_product_id,
      title: p.shopify_product_title ?? "",
    }))

    // Eviter les doublons
    if (currentProducts.some((p) => p.id === productId)) return

    await fetch(`/api/stories/videos/${videoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: [...currentProducts, { id: productId, title: productTitle }],
      }),
    })
    setAddDialogProduct(null)
    fetchData()
  }

  const filteredGroups = search
    ? groups.filter((g) => g.shopifyProductTitle.toLowerCase().includes(search.toLowerCase()))
    : groups

  // Videos pas encore liees a ce produit
  function getAvailableVideos(productId: string) {
    return allVideos.filter(
      (v) => !v.stories_video_products.some((p) => p.shopify_product_id === productId)
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Video Stories</h1>
        <p className="text-[13px] text-muted-foreground">Vue par produit</p>
      </div>

      <SubNav />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer les produits..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#007AFF]"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && groups.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-16">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">
            Aucun produit avec des vidéos. Ajoute des vidéos depuis la bibliothèque.
          </p>
        </div>
      )}

      {/* Product Groups */}
      {!loading &&
        filteredGroups.map((group) => (
          <div
            key={group.shopifyProductId}
            className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">
                {group.shopifyProductTitle}
              </h3>
              <button
                onClick={() => setAddDialogProduct(group.shopifyProductId)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#007AFF] hover:bg-[#EAF3FF] transition-colors"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </button>
            </div>

            {/* Story circles preview */}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {group.videos.map((v) => (
                <div key={v.id} className="flex flex-col items-center gap-1.5 shrink-0 group relative">
                  <div className="relative">
                    <div className="rounded-full p-[3px] bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
                      <div className="h-16 w-16 overflow-hidden rounded-full border-[3px] border-white bg-secondary">
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt={v.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl">{v.emoji}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveVideoFromProduct(v.id, group.shopifyProductId)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-[#E51C00] text-white shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground max-w-[70px] truncate text-center">
                    {v.emoji} {v.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* Add video dialog */}
      {addDialogProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddDialogProduct(null)}>
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold">Ajouter une vidéo</h3>
              <button onClick={() => setAddDialogProduct(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {getAvailableVideos(addDialogProduct).length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-foreground">
                Toutes les vidéos sont déjà associées à ce produit.
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {getAvailableVideos(addDialogProduct).map((v) => {
                  const group = groups.find((g) => g.shopifyProductId === addDialogProduct)
                  return (
                    <button
                      key={v.id}
                      onClick={() =>
                        handleAddVideoToProduct(
                          v.id,
                          addDialogProduct,
                          group?.shopifyProductTitle ?? addDialogProduct
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary transition-colors"
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary">
                        {v.thumbnail_url ? (
                          <img src={v.thumbnail_url} alt={v.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm">{v.emoji}</div>
                        )}
                      </div>
                      <span className="text-[13px] font-medium">
                        {v.emoji} {v.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
