"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Loader2, TrendingUp } from "lucide-react"

const CATEGORY_COLORS: Record<string, string> = {
  livraison: "#007AFF",
  remboursement: "#E67C00",
  qualite: "#C70A24",
  retour: "#8B5CF6",
  promo_fidelite: "#047B5D",
  question: "#005BD3",
  autre: "#8E8E93",
}

const CATEGORY_LABELS: Record<string, string> = {
  livraison: "Livraison",
  remboursement: "Remboursement",
  qualite: "Qualité",
  retour: "Retour",
  promo_fidelite: "Promo/Fidélité",
  question: "Question",
  autre: "Autre",
}

interface WeekData {
  label: string
  categories: Record<string, number>
}

export function SavTrendsChart() {
  const [weeksParam, setWeeksParam] = useState(8)
  const [data, setData] = useState<WeekData[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/trends?weeks=${weeksParam}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.weeks || [])
        setCategories(json.categories || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [weeksParam])

  useEffect(() => { fetchTrends() }, [fetchTrends])

  // Transform data for Recharts
  const chartData = data.map(w => ({
    name: w.label.replace(/^\d{4}-/, ""),
    ...w.categories,
  }))

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#007AFF]" />
          <h3 className="text-[14px] font-semibold">Tendances SAV</h3>
        </div>
        <div className="flex gap-1">
          {[4, 8, 12].map(w => (
            <button
              key={w}
              onClick={() => setWeeksParam(w)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                weeksParam === w
                  ? "bg-[#007AFF] text-white"
                  : "bg-[#F5F5F5] text-muted-foreground hover:bg-[#EBEBEB]"
              }`}
            >
              {w}s
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[220px] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground gap-2">
          <TrendingUp className="h-8 w-8 opacity-30" />
          <p className="text-[12px]">Aucune donnée — lancez un sync depuis le dashboard</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="20%">
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#8E8E93" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#8E8E93" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                backdropFilter: "blur(8px)",
              }}
              formatter={(value, name) => [String(value ?? 0), CATEGORY_LABELS[String(name)] || String(name)]}
            />
            <Legend
              iconType="circle"
              iconSize={6}
              formatter={(value: string) => (
                <span style={{ fontSize: 10, color: "#616161" }}>{CATEGORY_LABELS[value] || value}</span>
              )}
            />
            {categories.map(cat => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="stack"
                fill={CATEGORY_COLORS[cat] || "#8E8E93"}
                radius={cat === categories[categories.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
