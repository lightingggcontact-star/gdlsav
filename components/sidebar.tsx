"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  MapPin,
  RotateCcw,
  Lightbulb,
  Gamepad2,
} from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Messagerie", icon: MessageSquare, badgeKey: "messages" as const },
  { href: "/shipping", label: "Livraisons", icon: Package, badgeKey: "delayed" as const },
  { href: "/renvois", label: "Renvois", icon: RotateCcw },
  { href: "/forms", label: "Formulaires", icon: FileText },
  { href: "/google-fiches", label: "Google Fiches", icon: MapPin },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/jeu", label: "Jeu Fidélisation", icon: Gamepad2, separator: true },
  { href: "/settings", label: "Paramètres", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [delayedCount, setDelayedCount] = useState(0)
  const [openTicketsCount, setOpenTicketsCount] = useState(0)

  // Spam emails to exclude from open count
  const isSpamEmail = (email: string) => {
    const e = email.toLowerCase()
    return /^chronopost@network\d+\.pickup\.fr$/.test(e) || e === "enquetesatisfaction@chronopost.fr" || e === "no-reply@bounce.17track.net" || /^mailer-daemon@/i.test(e) || /^postmaster@/i.test(e)
  }

  useEffect(() => {
    let cancelled = false

    async function fetchDelayed() {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)
        const res = await fetch("/api/shipping?thresholdFR=3&thresholdBE=5", { signal: controller.signal })
        clearTimeout(timer)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setDelayedCount(data.stats?.delayed ?? 0)
        }
      } catch {
        // silent
      }
    }

    async function fetchOpenTickets() {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)
        const res = await fetch("/api/gorgias/tickets", { signal: controller.signal })
        clearTimeout(timer)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const tickets = data.data || []
          const openCount = tickets.filter(
            (t: { status: string; customer: { email: string } }) =>
              t.status === "open" && !isSpamEmail(t.customer.email)
          ).length
          setOpenTicketsCount(openCount)
        }
      } catch {
        // silent
      }
    }

    // Delay initial sidebar fetch by 2s to let messages page fetch first (shared server cache)
    const initTimer = setTimeout(() => { fetchDelayed(); fetchOpenTickets() }, 2000)
    const interval = setInterval(() => { fetchDelayed(); fetchOpenTickets() }, 5 * 60 * 1000)
    return () => { cancelled = true; clearTimeout(initTimer); clearInterval(interval) }
  }, [])

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/login")
    router.refresh()
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-card border border-border text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[240px] bg-card flex flex-col transition-transform duration-200",
          "border-r border-border",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 lg:hidden text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-5 pt-5 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center">
              <span className="text-white font-bold text-xs">GDL</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">GDL SAV</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Graine de Lascars</p>
            </div>
          </div>
        </div>

        <div className="mx-4 my-3 h-px bg-border" />

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            const badge = item.badgeKey === "delayed" ? delayedCount : item.badgeKey === "messages" ? openTicketsCount : 0

            return (
              <div key={item.href}>
              {"separator" in item && item.separator && <div className="mx-1 my-2 h-px bg-border" />}
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#EAF3FF] text-[#007AFF]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className={cn(
                    "min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center",
                    item.badgeKey === "messages" ? "bg-[#007AFF]" : "bg-[#E51C00]"
                  )}>
                    {badge}
                  </span>
                )}
              </Link>
              </div>
            )
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="px-3 py-2">
            <p className="text-[13px] font-medium text-foreground">Admin</p>
            <p className="text-[11px] text-muted-foreground">Responsable SAV</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-[#E51C00] hover:bg-[#FEE8EB] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
