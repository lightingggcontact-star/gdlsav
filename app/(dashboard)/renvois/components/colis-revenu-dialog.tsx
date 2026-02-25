"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, PackageCheck } from "lucide-react"
import { cn } from "@/lib/utils"
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

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSearchResults([])
    }
  }, [open])

  // Search Shopify orders
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

  async function handleSelect(order: SearchOrderResult) {
    setSubmitting(true)
    // Check if this order already has a renvoi
    const existing = renvois.find(
      (r) => r.shopifyOrderId === order.id || r.orderName === order.name
    )

    if (existing) {
      if (existing.colisRevenu) {
        // Already marked
        setSubmitting(false)
        onOpenChange(false)
        return
      }
      onConfirmExisting(existing.id)
    } else {
      onConfirmNew(order)
    }
    setSubmitting(false)
    setSearch("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Un colis est revenu ?
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            Recherche la commande dont le colis est revenu
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="N° commande, nom ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-[13px]"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 rounded-md border border-border p-1">
            {searching && (
              <p className="text-[13px] text-muted-foreground text-center py-6">Recherche...</p>
            )}
            {!searching && search.length >= 2 && searchResults.length === 0 && (
              <p className="text-[13px] text-muted-foreground text-center py-6">Aucune commande trouvee</p>
            )}
            {!searching && search.length < 2 && (
              <p className="text-[13px] text-muted-foreground/60 text-center py-8">
                Tape un nom, email ou numero de commande
              </p>
            )}
            {searchResults.map((order) => {
              const existingRenvoi = renvois.find(
                (r) => r.shopifyOrderId === order.id || r.orderName === order.name
              )
              const alreadyRevenu = existingRenvoi?.colisRevenu

              return (
                <button
                  key={order.id}
                  onClick={() => !alreadyRevenu && !submitting && handleSelect(order)}
                  disabled={alreadyRevenu || submitting}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                    alreadyRevenu
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-emerald-500/5 hover:ring-1 hover:ring-emerald-500/20 cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{order.name}</span>
                      <span className="text-[12px] text-muted-foreground">{order.customerName}</span>
                      {existingRenvoi && !alreadyRevenu && (
                        <Badge variant="secondary" className="text-[9px]">Renvoi existant</Badge>
                      )}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
