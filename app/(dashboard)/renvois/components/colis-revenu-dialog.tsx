"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, PackageCheck, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getReasonEmoji, getReasonLabel } from "@/lib/renvois"
import type { Renvoi } from "@/lib/types"

interface ColisRevenuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  renvois: Renvoi[]
  onConfirm: (renvoiId: string) => void
}

export function ColisRevenuDialog({ open, onOpenChange, renvois, onConfirm }: ColisRevenuDialogProps) {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Only show renvois that have NOT already been marked as revenu
  const candidates = useMemo(() => {
    return renvois.filter((r) => !r.colisRevenu)
  }, [renvois])

  const filtered = useMemo(() => {
    if (!search) return candidates
    const q = search.toLowerCase()
    return candidates.filter((r) =>
      r.orderName.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.trackingNumber.toLowerCase().includes(q)
    )
  }, [candidates, search])

  function handleConfirm() {
    if (!selectedId) return
    onConfirm(selectedId)
    setSearch("")
    setSelectedId(null)
    onOpenChange(false)
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setSearch("")
      setSelectedId(null)
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Colis revenu
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            Selectionnez le renvoi dont le colis original est revenu
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par commande, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-[13px]"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border border-border p-1">
            {filtered.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-6">
                {candidates.length === 0 ? "Aucun renvoi en attente" : "Aucun resultat"}
              </p>
            ) : (
              filtered.map((r) => {
                const isSelected = selectedId === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(isSelected ? null : r.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                      isSelected
                        ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "hover:bg-secondary"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "border-emerald-500 bg-emerald-500" : "border-border"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.orderName}</span>
                        <span className="text-[11px] text-muted-foreground">{r.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {getReasonEmoji(r.reason)} {getReasonLabel(r.reason)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">{r.orderTotal} €</span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Confirm */}
          <Button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <PackageCheck className="h-4 w-4" />
            Confirmer colis revenu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
