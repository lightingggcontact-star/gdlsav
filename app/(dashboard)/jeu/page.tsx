"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Gamepad2,
  Users,
  Link2,
  Gift,
  TrendingUp,
  ChevronRight,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface Stats {
  totalPlayers: number
  totalTokens: number
  rewardDistribution: { key: string; label: string; count: number }[]
  dailyParticipations: { date: string; count: number }[]
  tokenStatuses: Record<string, number>
}

const PIE_COLORS = ["#4CAF50", "#FFD700", "#007AFF", "#E67C00", "#C70A24"]

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  href,
}: {
  icon: typeof Gamepad2
  label: string
  value: number | string
  color: string
  href?: string
}) {
  const content = (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-[12px] text-muted-foreground">{label}</p>
        </div>
        {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export default function JeuDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/game/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const conversionRate =
    stats && stats.totalTokens > 0
      ? Math.round((stats.totalPlayers / stats.totalTokens) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jeu Fidélisation</h1>
          <p className="text-[13px] text-muted-foreground">
            Statistiques et gestion du mini-jeu client
          </p>
        </div>
        <Link
          href="/jeu/invitations"
          className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD]"
        >
          <Link2 className="h-4 w-4" />
          Générer un lien
        </Link>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={Users}
            label="Joueurs"
            value={stats?.totalPlayers ?? 0}
            color="#4CAF50"
            href="/jeu/joueurs"
          />
          <KpiCard
            icon={Link2}
            label="Liens générés"
            value={stats?.totalTokens ?? 0}
            color="#007AFF"
            href="/jeu/invitations"
          />
          <KpiCard
            icon={TrendingUp}
            label="Taux de conversion"
            value={`${conversionRate}%`}
            color="#E67C00"
          />
          <KpiCard
            icon={Gift}
            label="Récompenses"
            value={stats?.rewardDistribution?.length ?? 0}
            color="#9C27B0"
            href="/jeu/reglages"
          />
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Reward distribution */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
            <h3 className="mb-4 text-[14px] font-semibold text-foreground">Répartition des gains</h3>
            {stats.rewardDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.rewardDistribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(props: any) => `${props.name ?? ""} (${props.value ?? 0})`}
                    labelLine={false}
                  >
                    {stats.rewardDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-[13px] text-muted-foreground">
                Aucune donnée pour le moment
              </div>
            )}
          </div>

          {/* Daily participations */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
            <h3 className="mb-4 text-[14px] font-semibold text-foreground">Participations par jour</h3>
            {stats.dailyParticipations.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.dailyParticipations}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d: string) => {
                      const [, m, day] = d.split("-")
                      return `${day}/${m}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(d: any) => {
                      return new Date(String(d)).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                      })
                    }}
                  />
                  <Bar dataKey="count" fill="#4CAF50" radius={[4, 4, 0, 0]} name="Joueurs" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-[13px] text-muted-foreground">
                Aucune donnée pour le moment
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/jeu/joueurs", label: "Voir les joueurs", icon: Users },
          { href: "/jeu/invitations", label: "Gérer les invitations", icon: Link2 },
          { href: "/jeu/reglages", label: "Réglages du jeu", icon: Gift },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <link.icon className="h-4 w-4 text-muted-foreground" />
            {link.label}
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  )
}
