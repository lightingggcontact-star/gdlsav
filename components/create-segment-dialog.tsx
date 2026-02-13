"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Segment } from "@/lib/types"
import { createSegment, SEGMENT_COLORS } from "@/lib/segments"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { toast } from "sonner"

interface CreateSegmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: Set<string>
  onCreated: (segment: Segment) => void
}

export function CreateSegmentDialog({
  open,
  onOpenChange,
  selectedIds,
  onCreated,
}: CreateSegmentDialogProps) {
  const supabase = useSupabase()
  const [name, setName] = useState("")
  const [color, setColor] = useState<Segment["color"]>("purple")

  async function handleCreate() {
    if (!name.trim()) return
    const segment = await createSegment(supabase, name.trim(), color, Array.from(selectedIds))
    onCreated(segment)
    toast.success(`Segment "${name.trim()}" créé avec ${selectedIds.size} commande${selectedIds.size > 1 ? "s" : ""}`)
    setName("")
    setColor("purple")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un segment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-[13px] font-medium text-foreground mb-1.5 block">
              Nom du segment
            </label>
            <Input
              placeholder="Ex: Retard point relais semaine 6"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground mb-2 block">
              Couleur
            </label>
            <div className="flex gap-2">
              {SEGMENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    c.bg,
                    color === c.value
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                      : "opacity-60 hover:opacity-100"
                  )}
                  title={c.label}
                >
                  <div className={cn("w-3 h-3 rounded-full", c.dot)} />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-background p-3">
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{selectedIds.size}</span> commande{selectedIds.size > 1 ? "s" : ""} seront ajoutées à ce segment.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="bg-gdl-purple text-white hover:bg-gdl-purple/90"
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
