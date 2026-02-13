"use client"

import { useState } from "react"
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
}

const PRESETS = [
  { label: "7 jours", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "14 jours", getValue: () => ({ from: subDays(new Date(), 14), to: new Date() }) },
  { label: "3 semaines", getValue: () => ({ from: subDays(new Date(), 21), to: new Date() }) },
  { label: "Ce mois", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Mois dernier", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
]

export function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  function handlePreset(getValue: () => { from: Date; to: Date }) {
    const range = getValue()
    onDateRangeChange(range)
    setOpen(false)
  }

  function formatRange(range: DateRange | undefined): string {
    if (!range?.from) return "Choisir une période"
    if (!range.to) return format(range.from, "d MMM yyyy", { locale: fr })
    return `${format(range.from, "d MMM", { locale: fr })} – ${format(range.to, "d MMM yyyy", { locale: fr })}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 bg-secondary border-border text-sm font-normal h-9",
            !dateRange && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {formatRange(dateRange)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r border-border p-3 space-y-1 min-w-[130px]">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Raccourcis</p>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.getValue)}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {preset.label}
              </button>
            ))}
            <div className="h-px bg-border my-2" />
            <button
              onClick={() => {
                onDateRangeChange(undefined)
                setOpen(false)
              }}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Tout afficher
            </button>
          </div>
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              locale={fr}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
