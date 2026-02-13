"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Plus, FolderPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Segment } from "@/lib/types"
import { addOrdersToSegment, getSegmentColor } from "@/lib/segments"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { toast } from "sonner"

interface SegmentActionBarProps {
  selectedCount: number
  selectedIds: Set<string>
  segments: Segment[]
  onClearSelection: () => void
  onCreateSegment: () => void
  onSegmentsChange: () => void
}

export function SegmentActionBar({
  selectedCount,
  selectedIds,
  segments,
  onClearSelection,
  onCreateSegment,
  onSegmentsChange,
}: SegmentActionBarProps) {
  const supabase = useSupabase()
  const [showAddMenu, setShowAddMenu] = useState(false)

  if (selectedCount === 0) return null

  async function handleAddToSegment(segmentId: string) {
    await addOrdersToSegment(supabase, segmentId, Array.from(selectedIds))
    onSegmentsChange()
    setShowAddMenu(false)
    toast.success("Commandes ajoutées au segment")
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 bg-card border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,.08)] px-4 py-2.5">
        <span className="text-[13px] font-medium text-foreground">
          {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          size="sm"
          onClick={onCreateSegment}
          className="gap-1.5 bg-gdl-purple text-white hover:bg-gdl-purple/90 h-8 text-[13px]"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer segment
        </Button>

        {segments.length > 0 && (
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="gap-1.5 h-8 text-[13px]"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Ajouter à
            </Button>

            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 z-20 bg-card border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,.08)] py-1 min-w-50">
                  {segments.map((seg) => {
                    const color = getSegmentColor(seg.color)
                    return (
                      <button
                        key={seg.id}
                        onClick={() => handleAddToSegment(seg.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-secondary transition-colors"
                      >
                        <div className={cn("w-2 h-2 rounded-full", color.dot)} />
                        <span className="flex-1 truncate">{seg.name}</span>
                        <span className="text-xs text-muted-foreground">{seg.orderIds.length}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
