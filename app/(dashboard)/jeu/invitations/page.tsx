"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Link2,
  Search,
  Copy,
  Check,
  Plus,
  Clock,
  MousePointer,
  Gamepad2,
  AlertCircle,
} from "lucide-react"

interface Token {
  id: string
  email: string
  customer_name: string | null
  token: string
  created_at: string
  expires_at: string
  clicked_at: string | null
  status: "pending" | "clicked" | "played" | "expired"
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "#E67C00", bg: "#E67C0015" },
  clicked: { label: "Cliqué", color: "#007AFF", bg: "#007AFF15" },
  played: { label: "Joué", color: "#047B5D", bg: "#047B5D15" },
  expired: { label: "Expiré", color: "#C70A24", bg: "#C70A2415" },
}

export default function InvitationsPage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newGameUrl, setNewGameUrl] = useState<string | null>(null)

  const fetchTokens = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const res = await fetch(`/api/game/tokens?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTokens(data.tokens)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(fetchTokens, 300)
    return () => clearTimeout(timer)
  }, [fetchTokens])

  async function handleCreate() {
    if (!email.trim()) return
    setCreating(true)

    try {
      const res = await fetch("/api/game/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          customerName: customerName.trim() || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewGameUrl(data.gameUrl)
        setEmail("")
        setCustomerName("")
        setShowForm(false)
        fetchTokens()

        // Auto-copy
        await navigator.clipboard.writeText(data.gameUrl)
        setCopiedId("new")
        setTimeout(() => setCopiedId(null), 3000)
      }
    } catch {
      // silent
    } finally {
      setCreating(false)
    }
  }

  function getGameUrl(token: string) {
    const base = process.env.NEXT_PUBLIC_GAME_URL || "https://gdl-jeux.vercel.app"
    return `${base}?token=${token}`
  }

  async function copyLink(token: Token) {
    const url = getGameUrl(token.token)
    await navigator.clipboard.writeText(url)
    setCopiedId(token.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invitations</h1>
          <p className="text-[13px] text-muted-foreground">
            Générer et gérer les liens de jeu
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD]"
        >
          <Plus className="h-4 w-4" />
          Nouveau lien
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-[#007AFF]/30 bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
          <h3 className="mb-4 text-[14px] font-semibold text-foreground">Générer un lien</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Email du client *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@email.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Nom du client (optionnel)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!email.trim() || creating}
                className="rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
              >
                {creating ? "Création..." : "Générer le lien"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Newly created URL */}
      {newGameUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-[#047B5D]/30 bg-[#047B5D08] p-4">
          <Check className="h-5 w-5 shrink-0 text-[#047B5D]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">Lien créé et copié !</p>
            <p className="truncate text-[12px] text-muted-foreground">{newGameUrl}</p>
          </div>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(newGameUrl)
              setCopiedId("new")
              setTimeout(() => setCopiedId(null), 2000)
            }}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary"
          >
            {copiedId === "new" ? <Check className="h-3.5 w-3.5 text-[#047B5D]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par email ou nom..."
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
        />
      </div>

      {/* Tokens list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12">
          <Link2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">
            {search ? "Aucun lien trouvé" : "Aucun lien généré pour le moment"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => {
            const statusCfg = STATUS_CONFIG[token.status] ?? STATUS_CONFIG.pending
            const isExpired = new Date(token.expires_at) < new Date() && token.status !== "played"

            return (
              <div
                key={token.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: statusCfg.bg }}
                >
                  {token.status === "pending" && <Clock className="h-4 w-4" style={{ color: statusCfg.color }} />}
                  {token.status === "clicked" && <MousePointer className="h-4 w-4" style={{ color: statusCfg.color }} />}
                  {token.status === "played" && <Gamepad2 className="h-4 w-4" style={{ color: statusCfg.color }} />}
                  {token.status === "expired" && <AlertCircle className="h-4 w-4" style={{ color: statusCfg.color }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {token.customer_name || token.email}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">{token.email}</p>
                </div>
                <span
                  className="hidden rounded-md px-2 py-0.5 text-[11px] font-medium sm:block"
                  style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                >
                  {isExpired && token.status !== "expired" ? "Expiré" : statusCfg.label}
                </span>
                <span className="hidden text-[12px] text-muted-foreground lg:block">
                  {new Date(token.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {token.status !== "played" && !isExpired && (
                  <button
                    onClick={() => copyLink(token)}
                    className="shrink-0 rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary"
                    title="Copier le lien"
                  >
                    {copiedId === token.id ? (
                      <Check className="h-3.5 w-3.5 text-[#047B5D]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
