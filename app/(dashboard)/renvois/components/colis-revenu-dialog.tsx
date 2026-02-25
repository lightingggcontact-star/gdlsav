"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, PackageCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { getReasonEmoji } from "@/lib/renvois"
import type { Renvoi } from "@/lib/types"

interface SearchOrderResult {
  id: string
  name: string
  createdAt: string
  totalPrice: string
  fulfillmentStatus: string | null
  customerName: string
  customerEmail: string
}

interface ColisRevenuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  renvois: Renvoi[]
  onConfirmExisting: (renvoiId: string) => void
  onConfirmNew: (order: SearchOrderResult) => void
}

function formatCurrency(amount: string): string {
  const n = parseFloat(amount)
  if (isNaN(n)) return "0,00 \u20AC"
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014"
  const d = new Date(dateStr)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

export function ColisRevenuDialog({ open, onOpenChange, renvois, onConfirmExisting, onConfirmNew }: ColisRevenuDialogProps) {
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<SearchOrderResult[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Existing renvois not yet marked as revenu
  const suggestions = useMemo(() => {
    const candidates = renvois.filter((r) => !r.colisRevenu)
    if (!search) return candidates
    const q = search.toLowerCase()
    return candidates.filter((r) =>
      r.orderName.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.customerEmail.toLowerCase().includes(q)
    )
  }, [renvois, search])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSearchResults([])
    }
  }, [open])

  // Search Shopify orders only when typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.trim().length < 2) { setSearchResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/shopify/search-orders?q=${encodeURIComponent(search)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.orders ?? [])
        }
      } catch { /* silent */ } finally { setSearching(false) }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  async function handleSelectRenvoi(renvoi: Renvoi) {
    if (submitting) return
    setSubmitting(true)
    onConfirmExisting(renvoi.id)
    setSubmitting(false)
    setSearch("")
    onOpenChange(false)
  }

  async function handleSelectShopify(order: SearchOrderResult) {
    if (submitting) return
    setSubmitting(true)
    const existing = renvois.find(
      (r) => r.shopifyOrderId === order.id || r.orderName === order.name
    )
    if (existing) {
      if (!existing.colisRevenu) onConfirmExisting(existing.id)
    } else {
      onConfirmNew(order)
    }
    setSubmitting(false)
    setSearch("")
    onOpenChange(false)
  }

  // Filter out Shopify results that are already in suggestions
  const shopifyOnly = searchResults.filter((order) => {
    return !renvois.some((r) => r.shopifyOrderId === order.id || r.orderName === order.name)
  })

  const showShopifySection = search.length >= 2

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Un colis est revenu ?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher commande, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-[13px]"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1 rounded-md border border-border p-1">
            {/* Existing renvois — shown first */}
            {suggestions.length > 0 && (
              <>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-1.5 pb-1">
                  Renvois en cours
                </p>
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRenvoi(r)}
                    disabled={submitting}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-emerald-500/5 hover:ring-1 hover:ring-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{r.orderName}</span>
                        <span className="text-[12px] text-muted-foreground">{r.customerName}</span>
                        <Badge variant="secondary" className="text-[9px]">
                          {getReasonEmoji(r.reason)} {r.status === "a_renvoyer" ? "A renvoyer" : r.status === "expedie" ? "Expedie" : "Livre"}
                        </Badge>
                      </div>
                      <span className="text-[13px] font-medium">{formatCurrency(r.orderTotal)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{formatDate(r.renvoiDate)}</span>
                      {r.trackingNumber && (
                        <span className="text-[10px] font-mono text-muted-foreground/60">{r.trackingNumber}</span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Shopify search results — when typing */}
            {showShopifySection && (
              <>
                {(suggestions.length > 0 || shopifyOnly.length > 0) && (
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-2.5 pb-1">
                    Autres commandes Shopify
                  </p>
                )}
                {searching && (
                  <p className="text-[13px] text-muted-foreground text-center py-4">Recherche Shopify...</p>
                )}
                {!searching && shopifyOnly.length === 0 && suggestions.length === 0 && (
                  <p className="text-[13px] text-muted-foreground text-center py-4">Aucune commande trouvee</p>
                )}
                {!searching && shopifyOnly.map((order) => {
                  const alreadyRevenu = renvois.find(
                    (r) => (r.shopifyOrderId === order.id || r.orderName === order.name) && r.colisRevenu
                  )
                  return (
                    <button
                      key={order.id}
                      onClick={() => !alreadyRevenu && handleSelectShopify(order)}
                      disabled={!!alreadyRevenu || submitting}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                        alreadyRevenu
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-secondary cursor-pointer"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">{order.name}</span>
                          <span className="text-[12px] text-muted-foreground">{order.customerName}</span>
                          {alreadyRevenu && (
                            <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-600">Deja revenu</Badge>
                          )}
                        </div>
                        <span className="text-[13px] font-medium">{formatCurrency(order.totalPrice)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</span>
                        <span className="text-[11px] text-muted-foreground">{order.customerEmail}</span>
                      </div>
                    </button>
                  )
                })}
              </>
            )}

            {/* Empty state when no search and no suggestions */}
            {!showShopifySection && suggestions.length === 0 && (
              <p className="text-[13px] text-muted-foreground/60 text-center py-8">
                Aucun renvoi en cours — recherche une commande Shopify
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
