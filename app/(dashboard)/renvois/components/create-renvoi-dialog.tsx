"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { createRenvoi, REASON_OPTIONS } from "@/lib/renvois"
import type { RenvoiReason } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

interface SearchOrderResult {
  id: string
  name: string
  createdAt: string
  totalPrice: string
  fulfillmentStatus: string | null
  customerName: string
  customerEmail: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(amount: string): string {
  const n = parseFloat(amount)
  if (isNaN(n)) return "0,00 €"
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

export function CreateRenvoiDialog({
  open,
  onOpenChange,
  onCreated,
  supabase,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  supabase: SupabaseClient
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchOrderResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SearchOrderResult | null>(null)
  const [reason, setReason] = useState<RenvoiReason>("colis_perdu")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setStep(1)
      setSearchQuery("")
      setSearchResults([])
      setSelectedOrder(null)
      setReason("colis_perdu")
      setTrackingNumber("")
      setNote("")
    }
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (searchQuery.trim().length < 2) { setSearchResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/shopify/search-orders?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.orders ?? [])
        }
      } catch { /* silent */ } finally { setSearching(false) }
    }, 500)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  async function handleSubmit() {
    if (!selectedOrder) return
    setSubmitting(true)
    try {
      await createRenvoi(supabase, {
        shopifyOrderId: selectedOrder.id,
        orderName: selectedOrder.name,
        orderTotal: selectedOrder.totalPrice,
        customerName: selectedOrder.customerName,
        customerEmail: selectedOrder.customerEmail,
        reason,
        trackingNumber,
        note,
      })
      onCreated()
    } catch { toast.error("Erreur lors de la creation") } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Rechercher une commande" : "Details du renvoi"}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="N commande, nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-[13px]"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {searching && <div className="text-center py-6 text-[13px] text-muted-foreground">Recherche en cours...</div>}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-6 text-[13px] text-muted-foreground">Aucune commande trouvee.</div>
              )}
              {searchResults.map((order) => (
                <button
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); setStep(2) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium">{order.name}</span>
                      <span className="text-[12px] text-muted-foreground ml-2">{order.customerName}</span>
                    </div>
                    <span className="text-[13px] font-medium">{formatCurrency(order.totalPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</span>
                    {order.fulfillmentStatus && <Badge variant="secondary" className="text-[10px]">{order.fulfillmentStatus}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedOrder && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">{selectedOrder.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {selectedOrder.customerName} — {selectedOrder.customerEmail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-medium">{formatCurrency(selectedOrder.totalPrice)}</p>
                  <button onClick={() => setStep(1)} className="text-[11px] text-[#007AFF] hover:underline">Changer</button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Raison du renvoi</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as RenvoiReason)}
                className="w-full h-9 px-3 rounded-md border border-border bg-card text-[13px] text-foreground"
              >
                {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Numero de suivi du renvoi (optionnel)</label>
              <Input placeholder="Ex: 6A12345678901" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="text-[13px]" />
            </div>

            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Note (optionnel)</label>
              <Textarea placeholder="Contexte, details..." value={note} onChange={(e) => setNote(e.target.value)} className="text-[13px] min-h-[60px]" />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5 bg-[#007AFF] hover:bg-[#0066DD]">
                <Package className="h-3.5 w-3.5" />
                {submitting ? "Creation..." : "Creer le renvoi"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
