"use client"

import { useState, useEffect } from "react"
import { Settings, Save, ToggleLeft, ToggleRight } from "lucide-react"

interface Reward {
  key: string
  label: string
  probability: number
  type: "percentage" | "free_shipping" | "manual"
  value: number | null
}

interface GameSettings {
  id: string
  enabled: boolean
  rewards: Reward[]
  updated_at: string
}

export default function ReglagesPage() {
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/game/settings")
        if (res.ok) {
          const data = await res.json()
          setSettings(data.settings)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch("/api/game/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          rewards: settings.rewards,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!settings) return
    setSettings({ ...settings, enabled: !settings.enabled })
  }

  function updateRewardProbability(index: number, probability: number) {
    if (!settings) return
    const updated = [...settings.rewards]
    updated[index] = { ...updated[index], probability }
    setSettings({ ...settings, rewards: updated })
  }

  const totalProbability = settings?.rewards.reduce((sum, r) => sum + r.probability, 0) ?? 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-card" />
        <div className="h-[300px] animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">
          Réglages non trouvés. Exécutez le SQL de création des tables.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Réglages du jeu</h1>
          <p className="text-[13px] text-muted-foreground">
            Activer/désactiver le jeu et configurer les probabilités
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      {/* Toggle on/off */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">État du jeu</h3>
            <p className="text-[12px] text-muted-foreground">
              {settings.enabled
                ? "Le jeu est actif. Les clients peuvent jouer."
                : "Le jeu est désactivé. Les clients voient un message d'attente."}
            </p>
          </div>
          <button
            onClick={handleToggle}
            className="text-foreground transition-colors"
          >
            {settings.enabled ? (
              <ToggleRight className="h-10 w-10 text-[#047B5D]" />
            ) : (
              <ToggleLeft className="h-10 w-10 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Rewards probabilities */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-foreground">Probabilités des récompenses</h3>
          <span
            className={`text-[12px] font-medium ${
              Math.abs(totalProbability - 1) < 0.01 ? "text-[#047B5D]" : "text-[#C70A24]"
            }`}
          >
            Total : {(totalProbability * 100).toFixed(0)}%
            {Math.abs(totalProbability - 1) >= 0.01 && " (doit = 100%)"}
          </span>
        </div>

        <div className="space-y-4">
          {settings.rewards.map((reward, i) => (
            <div key={reward.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">{reward.label}</span>
                <span className="text-[13px] font-semibold text-foreground">
                  {(reward.probability * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(reward.probability * 100)}
                onChange={(e) => updateRewardProbability(i, parseInt(e.target.value) / 100)}
                className="w-full accent-[#007AFF]"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>0%</span>
                <span>
                  Type : {reward.type === "percentage" ? "% réduction" : reward.type === "free_shipping" ? "Livraison" : "Manuel"}
                </span>
                <span>100%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last updated */}
      <p className="text-[11px] text-muted-foreground">
        Dernière modification :{" "}
        {new Date(settings.updated_at).toLocaleString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  )
}
