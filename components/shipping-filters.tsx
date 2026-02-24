"use client"

import { useState } from "react"
import { Search, Tag, ChevronDown, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/date-range-picker"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"
import type { Segment } from "@/lib/types"
import { getSegmentColor, deleteSegment } from "@/lib/segments"
import { useSupabase } from "@/lib/supabase/use-supabase"
import type { ShippingStatsData } from "@/components/stat-cards"

export type AlertFilter =
  | "all"
  | "action_needed" | "delayed" | "problem" | "returned"
  | "in_progress" | "in_transit" | "out_for_delivery" | "pickup_ready"
  | "delivered"

export type CountryFilter = "all" | "FR" | "BE"

interface ShippingFiltersProps {
  alertFilter: AlertFilter
  countryFilter: CountryFilter
  searchQuery: string
  dateRange: DateRange | undefined
  counts?: ShippingStatsData
  segments?: Segment[]
  segmentFilter?: string
  onAlertFilterChange: (filter: AlertFilter) => void
  onCountryFilterChange: (filter: CountryFilter) => void
  onSearchChange: (query: string) => void
  onDateRangeChange: (range: DateRange | undefined) => void
  onSegmentFilterChange?: (segmentId: string) => void
  onSegmentsChange?: () => void
}

// Main filter options (top level)
const mainOptions: { value: AlertFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "action_needed", label: "A traiter" },
  { value: "delayed", label: "En retard" },
  { value: "in_progress", label: "En cours" },
  { value: "delivered", label: "Livrés" },
]

// Sub-filter chips for "A traiter" group
const actionSubFilters: { value: AlertFilter; label: string }[] = [
  { value: "problem", label: "Problèmes" },
  { value: "returned", label: "Retournés" },
]

// Sub-filter chips for "En cours" group
const progressSubFilters: { value: AlertFilter; label: string }[] = [
  { value: "in_transit", label: "En transit" },
  { value: "out_for_delivery", label: "En livraison" },
  { value: "pickup_ready", label: "Dispo retrait" },
]

function getMainCount(value: AlertFilter, counts?: ShippingStatsData): number | undefined {
  if (!counts) return undefined
  switch (value) {
    case "all": return counts.total
    case "action_needed": return counts.problem + counts.returned
    case "delayed": return counts.delayed
    case "in_progress": return counts.in_transit + counts.out_for_delivery + counts.pickup_ready
    case "delivered": return counts.delivered
    default: return undefined
  }
}

function getSubCount(value: AlertFilter, counts?: ShippingStatsData): number | undefined {
  if (!counts) return undefined
  switch (value) {
    case "problem": return counts.problem
    case "delayed": return counts.delayed
    case "returned": return counts.returned
    case "in_transit": return counts.in_transit
    case "out_for_delivery": return counts.out_for_delivery
    case "pickup_ready": return counts.pickup_ready
    default: return undefined
  }
}

const countryOptions: { value: CountryFilter; label: string }[] = [
  { value: "all", label: "Tous pays" },
  { value: "FR", label: "France" },
  { value: "BE", label: "Belgique" },
]

// Determine which main group a filter belongs to
function getActiveGroup(filter: AlertFilter): "action_needed" | "in_progress" | null {
  if (filter === "action_needed" || filter === "problem" || filter === "returned") return "action_needed"
  if (filter === "in_progress" || filter === "in_transit" || filter === "out_for_delivery" || filter === "pickup_ready") return "in_progress"
  return null
}

export function ShippingFilters({
  alertFilter,
  countryFilter,
  searchQuery,
  dateRange,
  counts,
  segments = [],
  segmentFilter = "all",
  onAlertFilterChange,
  onCountryFilterChange,
  onSearchChange,
  onDateRangeChange,
  onSegmentFilterChange,
  onSegmentsChange,
}: ShippingFiltersProps) {
  const supabase = useSupabase()
  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false)

  const activeSegment = segments.find((s) => s.id === segmentFilter)
  const activeGroup = getActiveGroup(alertFilter)

  // Determine which main button is "active"
  function isMainActive(value: AlertFilter): boolean {
    if (value === alertFilter) return true
    if (value === "action_needed" && activeGroup === "action_needed") return true
    if (value === "in_progress" && activeGroup === "in_progress") return true
    return false
  }

  function handleMainClick(value: AlertFilter) {
    if (value === "action_needed") {
      // If already in action group, toggle back to all
      if (activeGroup === "action_needed") {
        onAlertFilterChange("all")
      } else {
        onAlertFilterChange("action_needed")
      }
    } else if (value === "in_progress") {
      if (activeGroup === "in_progress") {
        onAlertFilterChange("all")
      } else {
        onAlertFilterChange("in_progress")
      }
    } else {
      // Toggle: clicking the active filter goes back to "all"
      onAlertFilterChange(alertFilter === value ? "all" : value)
    }
  }

  // Show sub-filters when a group is active
  const showActionSub = activeGroup === "action_needed"
  const showProgressSub = activeGroup === "in_progress"
  const subFilters = showActionSub ? actionSubFilters : showProgressSub ? progressSubFilters : null
  const parentFilter: AlertFilter | null = showActionSub ? "action_needed" : showProgressSub ? "in_progress" : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
        {/* Alert filter */}
        <div className="flex border border-border rounded-lg overflow-hidden bg-card">
          {mainOptions.map((opt) => {
            const count = getMainCount(opt.value, counts)
            return (
              <button
                key={opt.value}
                onClick={() => handleMainClick(opt.value)}
                className={cn(
                  "h-8 px-3 text-[13px] font-medium transition-colors border-r border-border last:border-r-0",
                  isMainActive(opt.value)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {opt.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1 text-[11px] text-muted-foreground">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Country filter */}
        <div className="flex border border-border rounded-lg overflow-hidden bg-card">
          {countryOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onCountryFilterChange(opt.value)}
              className={cn(
                "h-8 px-3 text-[13px] font-medium transition-colors border-r border-border last:border-r-0",
                countryFilter === opt.value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Segment filter */}
        {segments.length > 0 && onSegmentFilterChange && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSegmentDropdownOpen(!segmentDropdownOpen)}
              className={cn(
                "h-8 gap-2 text-[13px] font-medium",
                segmentFilter !== "all" && "bg-[#F3E8FF] text-gdl-purple border-gdl-purple/20"
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              {activeSegment ? (
                <span className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", getSegmentColor(activeSegment.color).dot)} />
                  {activeSegment.name}
                </span>
              ) : (
                "Segments"
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>

            {segmentDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSegmentDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,.08)] py-1 min-w-50">
                  <button
                    onClick={() => {
                      onSegmentFilterChange("all")
                      setSegmentDropdownOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-secondary transition-colors",
                      segmentFilter === "all" && "bg-secondary font-medium"
                    )}
                  >
                    Tous
                  </button>
                  <div className="h-px bg-border mx-2 my-1" />
                  {segments.map((seg) => {
                    const color = getSegmentColor(seg.color)
                    return (
                      <div key={seg.id} className="flex items-center group">
                        <button
                          onClick={() => {
                            onSegmentFilterChange(seg.id)
                            setSegmentDropdownOpen(false)
                          }}
                          className={cn(
                            "flex-1 flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-secondary transition-colors",
                            segmentFilter === seg.id && "bg-secondary font-medium"
                          )}
                        >
                          <span className={cn("w-2 h-2 rounded-full", color.dot)} />
                          <span className="flex-1 truncate">{seg.name}</span>
                          <span className="text-xs text-muted-foreground">{seg.orderIds.length}</span>
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            await deleteSegment(supabase, seg.id)
                            if (segmentFilter === seg.id) onSegmentFilterChange("all")
                            onSegmentsChange?.()
                            setSegmentDropdownOpen(false)
                          }}
                          className="px-2 py-2 text-muted-foreground hover:text-[#E51C00] opacity-0 group-hover:opacity-100 transition-all"
                          title="Supprimer segment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Date range */}
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
      </div>

      {/* Sub-filters (expanded when a group is active) */}
      {subFilters && parentFilter && (
        <div className="flex gap-1.5 flex-wrap">
          {subFilters.map((sub) => {
            const count = getSubCount(sub.value, counts)
            const isActive = alertFilter === sub.value
            return (
              <button
                key={sub.value}
                onClick={() => {
                  // Toggle: if already active, go back to parent group
                  onAlertFilterChange(isActive ? parentFilter : sub.value)
                }}
                className={cn(
                  "h-7 px-2.5 text-[12px] font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {sub.label}
                {count !== undefined && count > 0 && (
                  <span className={cn("ml-1 text-[10px]", isActive ? "opacity-70" : "text-muted-foreground/60")}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher client, commande, email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-card border-border h-9 text-sm"
        />
      </div>
    </div>
  )
}
