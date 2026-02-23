"use client"

import { useState, useEffect, useCallback } from "react"
import { Users, Search, Gift, Calendar } from "lucide-react"

interface Player {
  id: string
  email: string
  customer_name: string | null
  reward_key: string
  reward_label: string
  played_at: string
}

const REWARD_COLORS: Record<string, string> = {
  "10_percent": "#4CAF50",
  "1g_free": "#007AFF",
  "free_shipping": "#E67C00",
  "15_percent": "#9C27B0",
  "5g_jackpot": "#FFD700",
}

export default function JoueursPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchPlayers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const res = await fetch(`/api/game/players?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPlayers(data.players)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(fetchPlayers, 300)
    return () => clearTimeout(timer)
  }, [fetchPlayers])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Joueurs</h1>
        <p className="text-[13px] text-muted-foreground">
          {players.length} joueur{players.length !== 1 ? "s" : ""} au total
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par email, nom ou gain..."
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
        />
      </div>

      {/* Players list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">
            {search ? "Aucun joueur trouvé" : "Aucun joueur pour le moment"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                style={{ backgroundColor: REWARD_COLORS[player.reward_key] ?? "#666" }}
              >
                {(player.customer_name ?? player.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {player.customer_name || player.email}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">{player.email}</p>
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: REWARD_COLORS[player.reward_key] ?? "#666" }}
                >
                  {player.reward_label}
                </span>
              </div>
              <div className="hidden items-center gap-1.5 text-[12px] text-muted-foreground lg:flex">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(player.played_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
