"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  RefreshCw,
  Mail,
  Loader2,
  Sparkles,
  Send,
  ExternalLink,
  Copy,
  CheckCircle2,
  ChevronDown,
  XCircle,
  Search,
  Package,
  ShoppingBag,
  Truck,
  Star,
  X,
  Plus,
  Gift,
  RotateCcw,
  Check,
  Camera,
  Clock,
  Flame,
  MessageSquare,
  Phone,
  ArrowLeft,
  FileDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ComposeEmailDialog } from "@/components/compose-email-dialog"
import { useSupabase } from "@/lib/supabase/use-supabase"

// ─── Types ───

interface GorgiasCustomer {
  id: number
  name: string
  email: string
}

interface GorgiasAttachment {
  url: string
  name: string
  content_type: string
  size?: number
}

interface GorgiasMessage {
  id: number
  ticket_id: number
  channel: string
  from_agent: boolean
  sender: { id?: number; name?: string; email?: string }
  body_text: string | null
  body_html: string | null
  attachments: GorgiasAttachment[]
  public: boolean
  created_datetime: string
  sent_datetime: string | null
}

interface GorgiasTag {
  id: number
  name: string
  decoration?: { color?: string }
}

interface GorgiasTicket {
  id: number
  subject: string | null
  status: "open" | "closed"
  priority: "urgent" | "high" | "normal" | "low" | null
  channel: string
  customer: GorgiasCustomer
  created_datetime: string
  updated_datetime: string
  last_message_datetime: string | null
  messages_count: number
  tags: GorgiasTag[]
  language: string | null
}

interface CustomerOrder {
  id: string
  name: string
  createdAt: string
  totalPrice: string
  currency: string
  financialStatus: string | null
  fulfillmentStatus: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shipmentStatus: string | null
  countryCode: string
  photoUrl: string | null
}

interface CustomerOrderInfo {
  totalOrders: number
  totalSpent: string | null
  orders: CustomerOrder[]
}

interface JoyPoints {
  found: boolean
  points: number
  totalEarned?: number
  tier?: string | null
  joyId?: string
  email?: string
  shopifyCustomerId?: string | number | null
}

interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

interface SmsMessage {
  id: number
  phone: string
  message: string
  date: string
  direction: "in" | "out"
}

interface SmsConversation {
  phoneNumber: string
  lastMessage: string
  lastDate: string
  lastDirection: "in" | "out"
  messageCount: number
  messages: SmsMessage[]
}

interface SmsCustomerInfo {
  found: boolean
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string
    numberOfOrders: number
    totalSpent: string
    currency: string
    city: string | null
    countryCode: string
    tags: string[]
    createdAt: string
  } | null
  orders: {
    id: string
    name: string
    createdAt: string
    totalPrice: string
    currency: string
    financialStatus: string | null
    fulfillmentStatus: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    shipmentStatus: string | null
  }[]
}

// ─── Helpers ───

/** Extract image URLs from HTML body */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/** Strip quoted email chains, email client signatures, and common sign-offs */
function stripQuotedContent(text: string): string {
  const lines = text.split("\n")
  const cleanLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // French quote: "Le 9 févr. 2026 à 09:06, ... a écrit :"  (all on one line)
    if (/^Le\s+\d+\s+.+\d{4}\s+à\s+\d+[:.]\d+.*a\s+écrit\s*:/i.test(trimmed)) break
    // French quote with day-of-week: "Le mar. 10 févr. 2026, 13:00, ..."
    // May have "a écrit :" on same line or next lines
    if (/^Le\s+(lun|mar|mer|jeu|ven|sam|dim)\.?\s+\d+/i.test(trimmed)) break
    // Catch-all: any line starting with "Le " containing a year and a time
    if (/^Le\s+.+\d{4}.+\d{1,2}[:.]\d{2}/i.test(trimmed) && i > 0) break
    // Standalone "a écrit :" line (part of multi-line quote header)
    if (/^\s*a\s+[ée]crit\s*:\s*$/i.test(trimmed)) break
    // English quote: "On Sun, Feb 08 2026, at 09:29 AM, ... wrote:"
    if (/^On\s+.+wrote\s*:/i.test(trimmed)) break
    // Dutch quote: "Op do 12 feb. 2026 13:57 schreef ..."
    if (/^Op\s+.+schreef\s+/i.test(trimmed)) break
    // German quote: "Am 12.02.2026 um 13:57 schrieb ..."
    if (/^Am\s+.+schrieb\s+/i.test(trimmed)) break
    // "De :" / "From:" header block
    if (/^(De\s*:|From\s*:|Van\s*:|Von\s*:)\s+/i.test(trimmed) && i > 0) break
    // Separator lines
    if (/^-{3,}/.test(trimmed) && /message/i.test(trimmed)) break
    if (/^_{3,}/.test(trimmed)) break
    // "Envoyé à partir de Outlook/iPhone/etc"
    if (/^Envoy[ée]\s+(à partir de|depuis|de)/i.test(trimmed)) break
    // "Sent from my iPhone/Android"
    if (/^Sent from/i.test(trimmed)) break
    // "Get Outlook for"
    if (/^Get Outlook for/i.test(trimmed)) break
    // Email address in angle brackets on its own line (e.g. "<bonjour@grainedelascars.com>")
    if (/^<[^>]+@[^>]+>\s*$/.test(trimmed) && i > 0) break
    // Gmail ">" quoted lines (3+ consecutive)
    if (trimmed.startsWith(">")) {
      let allQuoted = true
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].trim() && !lines[j].trim().startsWith(">")) { allQuoted = false; break }
      }
      if (allQuoted) break
    }

    cleanLines.push(line)
  }

  let result = cleanLines.join("\n").trimEnd()

  // Remove trailing "Cordialement" + name/phone signature block
  result = result.replace(/\n\s*Cordialement\s*\n[\s\S]*$/i, "")

  // Remove trailing phone numbers on their own line
  result = result.replace(/\n\s*\d{2}[.\- ]\d{2}[.\- ]\d{2}[.\- ]\d{2}[.\- ]\d{2}\s*$/, "")

  // Remove trailing URL-only lines (e.g. <https://aka.ms/...>)
  result = result.replace(/\n\s*<?https?:\/\/\S+>?\s*$/, "")

  return result.trim()
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

/** Convert country code to flag emoji */
function countryFlag(code: string): string {
  const cc = code.toUpperCase()
  if (cc.length !== 2) return code
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

// ─── Spam detection ───

type SpamCategory = "chronopost" | "17track" | "bounced" | null

function getSpamCategory(email: string): SpamCategory {
  const e = email.toLowerCase()
  if (/^chronopost@network\d+\.pickup\.fr$/.test(e) || e === "enquetesatisfaction@chronopost.fr") return "chronopost"
  if (e === "no-reply@bounce.17track.net") return "17track"
  if (/^mailer-daemon@/i.test(e) || /^postmaster@/i.test(e)) return "bounced"
  return null
}

// ─── Ticket Labels ───

type TicketLabel = "urgent" | "en_attente"

// ─── Main Page ───

export default function MessagesPage() {
  const supabase = useSupabase()
  const [userId, setUserId] = useState<string | null>(null)

  const [allTickets, setAllTickets] = useState<GorgiasTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [composeOpen, setComposeOpen] = useState(false)

  // Ticket labels & selection
  const [ticketLabels, setTicketLabels] = useState<Record<string, TicketLabel>>({})
  const [activeTab, setActiveTab] = useState<"all" | "urgent" | "en_attente">("all")
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set())
  const [bulkClosing, setBulkClosing] = useState(false)

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [messages, setMessages] = useState<GorgiasMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  const [replyText, setReplyText] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [closing, setClosing] = useState(false)

  // Customer Shopify context
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderInfo | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)

  // Joy Loyalty points
  const [joyPoints, setJoyPoints] = useState<JoyPoints | null>(null)
  const [joyDropdownOpen, setJoyDropdownOpen] = useState(false)
  const [joyAddPoints, setJoyAddPoints] = useState("")
  const [joyActionLoading, setJoyActionLoading] = useState(false)
  const [joyExpired, setJoyExpired] = useState<{ points: number; date: string } | null>(null)
  const [joyExpiredLoading, setJoyExpiredLoading] = useState(false)
  const [joyExpiredChecked, setJoyExpiredChecked] = useState(false)
  const [joyRedeemCode, setJoyRedeemCode] = useState<{ code: string; pointsUsed: number } | null>(null)
  const joyDropdownRef = useRef<HTMLDivElement>(null)

  // Photo lightbox
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null)
  useEffect(() => {
    if (!photoLightbox) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPhotoLightbox(null) }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [photoLightbox])

  // SMS mode
  const [sidebarMode, setSidebarMode] = useState<"tickets" | "sms">("tickets")
  const [smsConversations, setSmsConversations] = useState<SmsConversation[]>([])
  const [smsLoading, setSmsLoading] = useState(false)
  const [selectedSmsPhone, setSelectedSmsPhone] = useState<string | null>(null)
  const [smsReplyText, setSmsReplyText] = useState("")
  const [smsSending, setSmsSending] = useState(false)
  const [smsNewNumber, setSmsNewNumber] = useState("")
  const [smsSearchQuery, setSmsSearchQuery] = useState("")
  const [smsCustomer, setSmsCustomer] = useState<SmsCustomerInfo | null>(null)
  const [smsCustomerLoading, setSmsCustomerLoading] = useState(false)
  const [smsCustomerCache, setSmsCustomerCache] = useState<Record<string, string>>({}) // phone → "Prénom Nom"
  const smsEndRef = useRef<HTMLDivElement>(null)

  // Mini AI chat
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [aiChatMessages, setAiChatMessages] = useState<AiChatMessage[]>([])
  const [aiChatInput, setAiChatInput] = useState("")
  const [aiChatLoading, setAiChatLoading] = useState(false)
  const aiChatEndRef = useRef<HTMLDivElement>(null)

  // Deep search (Gorgias API)
  const [deepSearchResults, setDeepSearchResults] = useState<GorgiasTicket[]>([])
  const [deepSearching, setDeepSearching] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ─── Read / Replied tracking (Supabase) ───
  const [readIds, setReadIds] = useState<Set<number>>(new Set())
  // repliedMap: ticketId → timestamp when we replied
  const [repliedMap, setRepliedMap] = useState<Map<number, string>>(new Map())

  // Load user ID, read/replied status, and labels from Supabase on mount
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        // Load ticket labels
        const { data: labelRows } = await supabase
          .from("ticket_labels")
          .select("*")
        if (labelRows) {
          const labelsMap: Record<string, TicketLabel> = {}
          for (const row of labelRows) {
            labelsMap[row.ticket_id] = row.label as TicketLabel
          }
          setTicketLabels(labelsMap)
        }

        // Load read ticket IDs
        const { data: readRows } = await supabase
          .from("ticket_read_status")
          .select("ticket_id")
          .eq("user_id", user.id)
        if (readRows) {
          setReadIds(new Set(readRows.map((r: { ticket_id: number }) => r.ticket_id)))
        }

        // Load replied ticket IDs + timestamps
        const { data: repliedRows } = await supabase
          .from("ticket_replied_status")
          .select("ticket_id, replied_at")
          .eq("user_id", user.id)
        if (repliedRows) {
          setRepliedMap(new Map(
            repliedRows.map((r: { ticket_id: number; replied_at: string }) => [r.ticket_id, r.replied_at])
          ))
        }
      } catch { /* silent */ }
    }
    loadFromSupabase()
  }, [supabase])

  async function markAsRead(ticketId: number) {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(ticketId)
      return next
    })
    if (userId) {
      await supabase
        .from("ticket_read_status")
        .upsert({ user_id: userId, ticket_id: ticketId, read_at: new Date().toISOString() })
    }
  }

  async function markAsReplied(ticketId: number) {
    const now = new Date().toISOString()
    setRepliedMap(prev => {
      const next = new Map(prev)
      next.set(ticketId, now)
      return next
    })
    if (userId) {
      await supabase
        .from("ticket_replied_status")
        .upsert({ user_id: userId, ticket_id: ticketId, replied_at: now })
    }
  }

  /** Check if ticket has new customer message after our reply */
  function hasNewMessageAfterReply(ticket: GorgiasTicket): boolean {
    const repliedAt = repliedMap.get(ticket.id)
    if (!repliedAt) return false
    const lastMsg = ticket.last_message_datetime || ticket.updated_datetime
    return new Date(lastMsg).getTime() > new Date(repliedAt).getTime() + 60000 // 1min buffer
  }

  /** Get ticket status: "unread" | "replied" | "read" */
  function getTicketReadStatus(ticket: GorgiasTicket): "unread" | "replied" | "read" {
    const isReplied = repliedMap.has(ticket.id)
    // If we replied but customer sent a new message → treat as unread again
    if (isReplied && hasNewMessageAfterReply(ticket)) {
      // Remove from replied since customer responded
      setRepliedMap(prev => {
        const next = new Map(prev)
        next.delete(ticket.id)
        return next
      })
      setReadIds(prev => {
        const next = new Set(prev)
        next.delete(ticket.id)
        return next
      })
      // Fire-and-forget Supabase cleanup
      if (userId) {
        supabase
          .from("ticket_replied_status")
          .delete()
          .eq("user_id", userId)
          .eq("ticket_id", ticket.id)
          .then()
        supabase
          .from("ticket_read_status")
          .delete()
          .eq("user_id", userId)
          .eq("ticket_id", ticket.id)
          .then()
      }
      return "unread"
    }
    if (isReplied) return "replied"
    if (readIds.has(ticket.id)) return "read"
    return "unread"
  }

  // Split tickets
  const openTickets = allTickets.filter(t => t.status === "open" && !getSpamCategory(t.customer.email))
  const chronoSpam = allTickets.filter(t => getSpamCategory(t.customer.email) === "chronopost")
  const trackSpam = allTickets.filter(t => getSpamCategory(t.customer.email) === "17track")
  const bouncedSpam = allTickets.filter(t => getSpamCategory(t.customer.email) === "bounced")
  const closedTickets = allTickets.filter(t => t.status === "closed" && !getSpamCategory(t.customer.email))
  const [showChronoSpam, setShowChronoSpam] = useState(false)
  const [showTrackSpam, setShowTrackSpam] = useState(false)
  const [showBouncedSpam, setShowBouncedSpam] = useState(false)

  // Tab title notification — show unread count
  const unreadCount = openTickets.filter(t => getTicketReadStatus(t) === "unread").length
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Messagerie — GDL SAV` : "Messagerie — GDL SAV"
  }, [unreadCount])

  // Search filter
  const q = searchQuery.toLowerCase().trim()
  const filterBySearch = (list: GorgiasTicket[]) =>
    q ? list.filter(t =>
      (t.customer.name || "").toLowerCase().includes(q) ||
      t.customer.email.toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q) ||
      String(t.id).includes(q)
    ) : list

  const filteredOpen = filterBySearch(openTickets)
  const filteredChronoSpam = filterBySearch(chronoSpam)
  const filteredTrackSpam = filterBySearch(trackSpam)
  const filteredBouncedSpam = filterBySearch(bouncedSpam)
  const filteredClosed = filterBySearch(closedTickets)

  // Label-based tab filtering
  const urgentTickets = filteredOpen.filter(t => ticketLabels[String(t.id)] === "urgent")
  const enAttenteTickets = filteredOpen.filter(t => ticketLabels[String(t.id)] === "en_attente")
  const tabbedOpen = activeTab === "urgent"
    ? urgentTickets
    : activeTab === "en_attente"
      ? enAttenteTickets
      : filteredOpen

  // Group tickets by customer email, sorted by read status then most recent
  function groupByCustomer(tickets: GorgiasTicket[]) {
    const groups = new Map<string, GorgiasTicket[]>()
    for (const t of tickets) {
      const key = t.customer.email.toLowerCase()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    // Sort each group internally by most recent first
    for (const g of groups.values()) {
      g.sort((a, b) => new Date(b.last_message_datetime || b.updated_datetime).getTime() - new Date(a.last_message_datetime || a.updated_datetime).getTime())
    }
    // Sort groups: replied tickets at bottom, everything else by most recent
    function groupPriority(group: GorgiasTicket[]): number {
      // If ALL tickets in group are replied → push to bottom
      const allReplied = group.every(t => getTicketReadStatus(t) === "replied")
      return allReplied ? 1 : 0
    }
    return [...groups.values()].sort((a, b) => {
      const pa = groupPriority(a)
      const pb = groupPriority(b)
      if (pa !== pb) return pa - pb
      return new Date(b[0].last_message_datetime || b[0].updated_datetime).getTime() -
        new Date(a[0].last_message_datetime || a[0].updated_datetime).getTime()
    })
  }

  const groupedOpen = groupByCustomer(tabbedOpen)
  const groupedClosed = groupByCustomer(filteredClosed)

  // Unified search results (local + deep search merged, deduped)
  const allLocalMatches = q ? [...filteredOpen, ...filteredClosed, ...filteredChronoSpam, ...filteredTrackSpam, ...filteredBouncedSpam] : []
  const localMatchIds = new Set(allLocalMatches.map(t => t.id))
  const deepOnly = deepSearchResults.filter(t => !localMatchIds.has(t.id))
  const allSearchMatches = [...allLocalMatches, ...deepOnly]
  const groupedSearch = q ? groupByCustomer(allSearchMatches) : []

  // Debounced deep search via Gorgias API
  useEffect(() => {
    if (!q || q.length < 3) {
      setDeepSearchResults([])
      setDeepSearching(false)
      return
    }
    setDeepSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gorgias/search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          setDeepSearchResults(data.data || [])
        }
      } catch {
        // Silently fail — local results still shown
      } finally {
        setDeepSearching(false)
      }
    }, 800)
    return () => {
      clearTimeout(timer)
      setDeepSearching(false)
    }
  }, [q])

  // ─── Fetch tickets ───

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/gorgias/tickets")
      if (res.ok) {
        const data = await res.json()
        setAllTickets(data.data || [])
      } else {
        const err = await res.json().catch(() => ({}))
        console.error("Gorgias error:", res.status, err)
        toast.error(`Erreur chargement tickets (${res.status})`)
      }
    } catch (err) {
      console.error("Fetch tickets error:", err)
      toast.error("Erreur de connexion")
    }
  }, [])

  useEffect(() => {
    setTicketsLoading(true)
    fetchTickets().finally(() => setTicketsLoading(false))
  }, [fetchTickets])

  async function handleRefresh() {
    setRefreshing(true)
    if (sidebarMode === "sms") {
      await fetchSmsConversations()
    } else {
      await fetchTickets()
      if (selectedTicketId) await fetchMessages(selectedTicketId)
    }
    setRefreshing(false)
  }

  // ─── Weekly recap download (AI-powered) ───

  const [recapLoading, setRecapLoading] = useState(false)

  async function downloadWeeklyRecap() {
    setRecapLoading(true)
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const recentTickets = allTickets.filter(
        (t) => new Date(t.updated_datetime) >= oneWeekAgo
      )

      if (recentTickets.length === 0) {
        toast.info("Aucun ticket cette semaine")
        setRecapLoading(false)
        return
      }

      toast.info(`Analyse de ${recentTickets.length} tickets en cours...`)

      // Fetch messages for each ticket (in parallel, max 5 at a time)
      const ticketsForRecap: Array<{
        id: number; subject: string | null; status: string; priority: string | null
        customerName: string; customerEmail: string; createdAt: string
        tags: string[]; firstMessage: string; lastMessage: string; messageCount: number
      }> = []

      for (let i = 0; i < recentTickets.length; i += 5) {
        const batch = recentTickets.slice(i, i + 5)
        const results = await Promise.all(
          batch.map(async (ticket) => {
            let publicMsgs: GorgiasMessage[] = []
            try {
              const res = await fetch(`/api/gorgias/tickets/${ticket.id}/messages`)
              if (res.ok) {
                const data = await res.json()
                publicMsgs = ((data.data || []) as GorgiasMessage[]).filter(m => m.public)
              }
            } catch { /* skip */ }

            const firstMsg = publicMsgs[0]
            const lastMsg = publicMsgs[publicMsgs.length - 1]

            return {
              id: ticket.id,
              subject: ticket.subject,
              status: ticket.status,
              priority: ticket.priority,
              customerName: ticket.customer.name || ticket.customer.email,
              customerEmail: ticket.customer.email,
              createdAt: new Date(ticket.created_datetime).toLocaleDateString("fr-FR"),
              tags: ticket.tags.map(t => t.name),
              firstMessage: firstMsg
                ? stripQuotedContent(firstMsg.body_text || stripHtml(firstMsg.body_html || ""))
                : "",
              lastMessage: lastMsg
                ? stripQuotedContent(lastMsg.body_text || stripHtml(lastMsg.body_html || ""))
                : "",
              messageCount: publicMsgs.length,
            }
          })
        )
        ticketsForRecap.push(...results)
      }

      // Call AI to generate the recap
      const res = await fetch("/api/ai/ticket-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets: ticketsForRecap }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Erreur IA")
        setRecapLoading(false)
        return
      }

      const { recap } = await res.json()

      // Download
      const blob = new Blob([recap], { type: "text/markdown;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `recap-sav-${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Récap IA généré (${recentTickets.length} tickets analysés)`)
    } catch {
      toast.error("Erreur lors de la génération du récap")
    }
    setRecapLoading(false)
  }

  // ─── SMS functions ───

  const fetchSmsConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/messages")
      if (res.ok) {
        const data = await res.json()
        setSmsConversations(data.data || [])
      } else {
        toast.error("Erreur chargement SMS")
      }
    } catch {
      toast.error("Erreur connexion SMS")
    }
  }, [])

  useEffect(() => {
    if (sidebarMode === "sms" && smsConversations.length === 0) {
      setSmsLoading(true)
      fetchSmsConversations().finally(() => setSmsLoading(false))
    }
  }, [sidebarMode, fetchSmsConversations, smsConversations.length])

  // Auto-load Shopify customer names for all SMS conversations (single batch call)
  const smsBatchFetchedRef = useRef(false)
  useEffect(() => {
    if (smsConversations.length === 0 || smsBatchFetchedRef.current) return
    smsBatchFetchedRef.current = true
    const phones = smsConversations.map(c => c.phoneNumber)
    fetch("/api/shopify/customers-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (!res?.data) return
        const cache: Record<string, string> = {}
        for (const [phone, customer] of Object.entries(res.data)) {
          if (customer && typeof customer === "object" && "firstName" in customer) {
            const c = customer as { firstName: string; lastName: string }
            const name = `${c.firstName} ${c.lastName}`.trim()
            if (name) cache[phone] = name
          }
        }
        if (Object.keys(cache).length > 0) {
          setSmsCustomerCache(prev => ({ ...prev, ...cache }))
        }
      })
      .catch(() => {})
  }, [smsConversations])

  // Scroll to bottom of SMS thread
  useEffect(() => {
    smsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedSmsPhone, smsConversations])

  const selectedSmsConversation = smsConversations.find(c => c.phoneNumber === selectedSmsPhone)

  async function handleSmsSend() {
    const phone = selectedSmsPhone || smsNewNumber.trim()
    if (!phone || !smsReplyText.trim()) return
    setSmsSending(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, message: smsReplyText.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("SMS envoyé")
        setSmsReplyText("")
        setSmsNewNumber("")
        // Refresh conversations
        await fetchSmsConversations()
        if (!selectedSmsPhone && phone) setSelectedSmsPhone(phone)
      } else {
        toast.error(data.error || "Erreur envoi SMS")
      }
    } catch {
      toast.error("Erreur connexion")
    } finally {
      setSmsSending(false)
    }
  }

  function formatSmsPhone(phone: string): string {
    // Format for display: +33 6 56 80 93 33
    if (phone.startsWith("+33") && phone.length === 12) {
      return `+33 ${phone[3]} ${phone.slice(4, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)} ${phone.slice(10, 12)}`
    }
    if (phone.startsWith("+32") && phone.length === 12) {
      return `+32 ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)} ${phone.slice(10, 12)}`
    }
    return phone
  }

  // Fetch Shopify customer info when SMS conversation is selected
  useEffect(() => {
    if (!selectedSmsPhone) {
      setSmsCustomer(null)
      return
    }
    let cancelled = false
    setSmsCustomerLoading(true)
    setSmsCustomer(null)
    fetch(`/api/shopify/customer-by-phone?phone=${encodeURIComponent(selectedSmsPhone)}`)
      .then(res => res.ok ? res.json() : null)
      .then((data: SmsCustomerInfo | null) => {
        if (!cancelled && data) {
          setSmsCustomer(data)
          // Cache name for sidebar display
          if (data.found && data.customer && selectedSmsPhone) {
            const name = `${data.customer.firstName} ${data.customer.lastName}`.trim()
            if (name) setSmsCustomerCache(prev => ({ ...prev, [selectedSmsPhone]: name }))
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSmsCustomerLoading(false) })
    return () => { cancelled = true }
  }, [selectedSmsPhone])

  // ─── Fetch messages ───

  async function fetchMessages(ticketId: number) {
    setMessagesLoading(true)
    setMessages([])
    try {
      const res = await fetch(`/api/gorgias/tickets/${ticketId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.data || [])
      }
    } catch { /* silent */ }
    setMessagesLoading(false)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  async function fetchCustomerOrders(email: string) {
    setOrdersLoading(true)
    setCustomerOrders(null)
    try {
      const res = await fetch(`/api/shopify/customer-orders?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerOrders(data)
      }
    } catch { /* silent */ }
    setOrdersLoading(false)
  }

  async function fetchJoyPoints(email: string) {
    setJoyPoints(null)
    setJoyExpired(null)
    setJoyExpiredChecked(false)
    setJoyRedeemCode(null)
    try {
      const res = await fetch(`/api/joy/customer-points?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        setJoyPoints(data)
        // Fetch expired points info if customer found
        if (data.found && data.shopifyCustomerId) {
          fetchExpiredPoints(data.shopifyCustomerId)
        } else {
          setJoyExpiredChecked(true)
        }
      }
    } catch { /* silent */ }
  }

  async function fetchExpiredPoints(shopifyCustomerId: string | number) {
    setJoyExpiredLoading(true)
    try {
      const res = await fetch("/api/joy/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-expired", shopifyCustomerId }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.found && data.expiredPoints > 0) {
        setJoyExpired({ points: data.expiredPoints, date: data.expiredDate })
      }
    } catch { /* silent */ }
    setJoyExpiredLoading(false)
    setJoyExpiredChecked(true)
  }

  async function handleJoyAction(action: string, points?: number) {
    if (!joyPoints?.shopifyCustomerId) return
    setJoyActionLoading(true)
    try {
      const body: Record<string, unknown> = {
        action,
        shopifyCustomerId: joyPoints.shopifyCustomerId,
      }
      if (action === "award" && points) body.points = points
      if (action === "adjust" && points) body.points = points
      if (action === "redeem") body.programId = "ox5BlxmBmuC9lj3P1kPo"

      const res = await fetch("/api/joy/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (action === "redeem" && data.data) {
          // Joy redeem returns coupon code — capture it
          const code = data.data.discountCode || data.data.code || data.data.couponCode || data.data.discount_code || null
          const pointsUsed = data.data.pointCost || data.data.point_cost || data.data.points || 10
          if (code) {
            setJoyRedeemCode({ code, pointsUsed })
          }
          toast.success("Code promo créé !")
        } else {
          toast.success(
            action === "award" ? `+${points} points ajoutés` :
            action === "adjust" ? `Points rétablis (+${points})` :
            "Action Joy réussie"
          )
        }
        setJoyAddPoints("")
        // Refresh joy points
        if (selectedTicket) fetchJoyPoints(selectedTicket.customer.email)
      } else {
        toast.error(data.error || "Erreur Joy")
      }
    } catch {
      toast.error("Erreur de connexion Joy")
    }
    setJoyActionLoading(false)
  }

  async function handleRestoreExpired() {
    if (!joyPoints?.shopifyCustomerId || !joyExpired) return
    const expDate = new Date(joyExpired.date).toLocaleDateString("fr-FR")
    const confirmed = confirm(`Rétablir ${joyExpired.points} points expirés le ${expDate} ?`)
    if (!confirmed) return
    await handleJoyAction("adjust", joyExpired.points)
    setJoyExpired(null)
  }

  // Close Joy dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (joyDropdownRef.current && !joyDropdownRef.current.contains(e.target as Node)) {
        setJoyDropdownOpen(false)
      }
    }
    if (joyDropdownOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [joyDropdownOpen])

  function handleSelectTicket(ticket: GorgiasTicket) {
    setSelectedTicketId(ticket.id)
    setReplyText("")
    setSendSuccess(false)
    setAiChatOpen(false)
    setAiChatMessages([])
    setAiChatInput("")
    setJoyDropdownOpen(false)
    setJoyAddPoints("")
    markAsRead(ticket.id)
    fetchMessages(ticket.id)
    fetchCustomerOrders(ticket.customer.email)
    fetchJoyPoints(ticket.customer.email)
  }

  // ─── AI Reply ───

  async function handleGenerateReply() {
    if (!selectedTicketId) return
    const ticket = allTickets.find(t => t.id === selectedTicketId)
    if (!ticket) return

    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: ticket.customer.name || ticket.customer.email,
          customerEmail: ticket.customer.email,
          ticketSubject: ticket.subject,
          conversationHistory: messages
            .filter(m => m.public)
            .map(m => ({
              from_agent: m.from_agent,
              senderName: m.sender?.name || m.sender?.email || (m.from_agent ? "Agent" : "Client"),
              body: m.body_text || stripHtml(m.body_html || ""),
              date: m.created_datetime,
            })),
          customerOrders: customerOrders ? {
            ...customerOrders,
            orders: customerOrders.orders.map(o => ({
              ...o,
              countryCode: o.countryCode,
            })),
          } : undefined,
          joyPoints: joyPoints || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setReplyText(data.reply)
        toast.success("Réponse générée")
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Erreur IA")
      }
    } catch {
      toast.error("Erreur de connexion")
    }
    setGenerating(false)
  }

  // ─── Mini AI Chat ───

  async function handleAiChat() {
    if (!aiChatInput.trim() || !selectedTicketId) return
    const ticket = allTickets.find(t => t.id === selectedTicketId)
    if (!ticket) return

    const userMsg = aiChatInput.trim()
    setAiChatInput("")
    setAiChatMessages(prev => [...prev, { role: "user", content: userMsg }])
    setAiChatLoading(true)

    try {
      // Build full conversation with timestamps
      const convoSummary = messages
        .filter(m => m.public)
        .map(m => {
          const role = m.from_agent ? "AGENT (Baba)" : "CLIENT"
          const dt = new Date(m.created_datetime)
          const dateStr = dt.toLocaleString("fr-FR", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })
          const body = stripQuotedContent(m.body_text || stripHtml(m.body_html || ""))
          return `[${role} — ${dateStr}] ${body}`
        })
        .join("\n\n")

      // Build full order info
      let orderInfo = ""
      if (customerOrders && customerOrders.orders.length > 0) {
        const orderLines = customerOrders.orders.slice(0, 5).map(o => {
          const date = new Date(o.createdAt).toLocaleDateString("fr-FR")
          return `  • ${o.name} — ${date} — ${o.totalPrice}€ — ${o.fulfillmentStatus || "?"} — Tracking: ${o.trackingNumber || "aucun"}${o.trackingUrl ? ` (${o.trackingUrl})` : ""} — ${o.countryCode}`
        })
        const totalSpentStr = customerOrders.totalSpent ? ` — Total dépensé: ${parseFloat(customerOrders.totalSpent).toFixed(0)}€` : ""
        orderInfo = `\nCommandes (${customerOrders.totalOrders} au total${totalSpentStr}):\n${orderLines.join("\n")}`
      }

      const joyInfo = joyPoints?.found
        ? `\nFidélité Joy: ${joyPoints.points} pts dispo (10pts=1€)${joyPoints.totalEarned ? ` — Total gagné: ${joyPoints.totalEarned} pts` : ""}${joyPoints.tier ? ` — Niveau: ${joyPoints.tier}` : ""}`
        : ""

      const res = await fetch("/api/ai/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: ticket.customer.name || ticket.customer.email,
          customerEmail: ticket.customer.email,
          ticketSubject: ticket.subject,
          conversationHistory: [
            {
              from_agent: false,
              senderName: "CONTEXTE",
              body: `CONTEXTE DU TICKET:\nClient: ${ticket.customer.name} (${ticket.customer.email})\nSujet: ${ticket.subject || "Sans objet"}${orderInfo}${joyInfo}\n\nHISTORIQUE COMPLET (avec dates et heures):\n${convoSummary}\n\n---\nQUESTION INTERNE DE L'AGENT (ne pas formater comme un email, réponds directement de manière concise comme un assistant):\n${userMsg}`,
              date: new Date().toISOString(),
            },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiChatMessages(prev => [...prev, { role: "assistant", content: data.reply }])
      } else {
        setAiChatMessages(prev => [...prev, { role: "assistant", content: "Erreur lors de la génération." }])
      }
    } catch {
      setAiChatMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }])
    }
    setAiChatLoading(false)
    setTimeout(() => aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  // ─── Send Reply ───

  async function handleSendReply() {
    if (!selectedTicketId || !replyText.trim()) return
    const ticket = allTickets.find(t => t.id === selectedTicketId)
    if (!ticket) return

    setSending(true)
    setSendSuccess(false)
    try {
      const res = await fetch(`/api/gorgias/tickets/${selectedTicketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: replyText,
          bodyHtml: `<p>${replyText.replace(/\n/g, "<br>")}</p>`,
          customerEmail: ticket.customer.email,
          customerName: ticket.customer.name,
        }),
      })
      if (res.ok) {
        setSendSuccess(true)
        toast.success("Email envoyé !")
        setReplyText("")
        markAsReplied(selectedTicketId)
        await fetchMessages(selectedTicketId)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Erreur envoi")
      }
    } catch {
      toast.error("Erreur de connexion")
    }
    setSending(false)
  }

  // ─── Close ticket ───

  async function handleCloseTicket() {
    if (!selectedTicketId) return
    setClosing(true)
    try {
      const res = await fetch(`/api/gorgias/tickets/${selectedTicketId}/close`, {
        method: "PUT",
      })
      if (res.ok) {
        toast.success("Ticket fermé")
        setAllTickets(prev =>
          prev.map(t => t.id === selectedTicketId ? { ...t, status: "closed" as const } : t)
        )
        setSelectedTicketId(null)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Erreur fermeture")
      }
    } catch {
      toast.error("Erreur de connexion")
    }
    setClosing(false)
  }

  // ─── Bulk Actions ───

  async function handleBulkClose() {
    const ids = [...selectedTicketIds]
    if (ids.length === 0) return
    const confirmed = confirm(`Fermer ${ids.length} ticket${ids.length > 1 ? "s" : ""} ?`)
    if (!confirmed) return

    setBulkClosing(true)
    let closed = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/gorgias/tickets/${id}/close`, { method: "PUT" })
        if (res.ok) {
          setAllTickets(prev => prev.map(t => t.id === id ? { ...t, status: "closed" as const } : t))
          closed++
        }
      } catch { /* continue */ }
      if (ids.indexOf(id) < ids.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }
    toast.success(`${closed} ticket${closed > 1 ? "s" : ""} fermé${closed > 1 ? "s" : ""}`)
    setSelectedTicketIds(new Set())
    setBulkClosing(false)
  }

  async function handleBulkLabel(label: TicketLabel) {
    const ids = [...selectedTicketIds]
    if (ids.length === 0) return
    setTicketLabels(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[String(id)] = label })
      return next
    })
    // Persist to Supabase
    const rows = ids.map(id => ({
      ticket_id: String(id),
      label,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from("ticket_labels").upsert(rows)
    toast.success(
      label === "urgent"
        ? `${ids.length} ticket${ids.length > 1 ? "s" : ""} marqué${ids.length > 1 ? "s" : ""} urgent`
        : `${ids.length} ticket${ids.length > 1 ? "s" : ""} mis en attente`
    )
    setSelectedTicketIds(new Set())
  }

  async function handleBulkRemoveLabel() {
    const ids = [...selectedTicketIds]
    if (ids.length === 0) return
    setTicketLabels(prev => {
      const next = { ...prev }
      ids.forEach(id => { delete next[String(id)] })
      return next
    })
    // Remove from Supabase
    await supabase
      .from("ticket_labels")
      .delete()
      .in("ticket_id", ids.map(id => String(id)))
    toast.success(`${ids.length} ticket${ids.length > 1 ? "s" : ""} remis à traiter`)
    setSelectedTicketIds(new Set())
  }

  // ─── Render ───

  const selectedTicket = allTickets.find(t => t.id === selectedTicketId)

  /** Render a group of tickets from the same customer */
  function TicketGroup({ tickets }: { tickets: GorgiasTicket[] }) {
    const first = tickets[0]
    const customerName = first.customer.name || first.customer.email.split("@")[0]
    const anyBulkSelected = tickets.some(t => selectedTicketIds.has(t.id))
    const allBulkSelected = tickets.every(t => selectedTicketIds.has(t.id))
    const groupStatus = tickets.some(t => getTicketReadStatus(t) === "unread")
      ? "unread"
      : tickets.every(t => getTicketReadStatus(t) === "replied")
        ? "replied"
        : "read"
    const hasMultiple = tickets.length > 1

    return (
      <div className={cn(
        "transition-all",
        groupStatus === "replied" && "opacity-50"
      )}>
        {tickets.map((ticket, idx) => {
          const isSelected = ticket.id === selectedTicketId
          const lastDate = ticket.last_message_datetime || ticket.updated_datetime
          const ticketStatus = getTicketReadStatus(ticket)
          const ticketLabel = ticketLabels[String(ticket.id)] as TicketLabel | undefined
          const isBulkSelected = selectedTicketIds.has(ticket.id)
          const isFirst = idx === 0
          const isLast = idx === tickets.length - 1

          return (
            <button
              key={ticket.id}
              onClick={() => handleSelectTicket(ticket)}
              className={cn(
                "w-full text-left px-3 py-2.5 transition-all flex items-start gap-3",
                isSelected
                  ? "bg-[#6B2D8B] text-white"
                  : isBulkSelected
                    ? "bg-[#F3EAFA]"
                    : "hover:bg-white",
                // Si multi-ticket, on colle les rows et on met une ligne fine entre elles
                hasMultiple && !isFirst && "border-t border-[#E4E4E7]/60",
                hasMultiple && !isLast && !isSelected && "pb-2",
              )}
            >
              {/* Avatar — seulement sur le premier ticket du groupe */}
              {isFirst ? (
                <div
                  className="relative shrink-0 cursor-pointer mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    const ids = tickets.map(t => t.id)
                    setSelectedTicketIds(prev => {
                      const next = new Set(prev)
                      if (allBulkSelected) ids.forEach(id => next.delete(id))
                      else ids.forEach(id => next.add(id))
                      return next
                    })
                  }}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                    isSelected ? "bg-white/20 text-white"
                      : isBulkSelected || anyBulkSelected ? "bg-[#6B2D8B] text-white"
                      : ticketStatus === "unread" ? "bg-[#6B2D8B] text-white"
                      : "bg-[#E9E9EB] text-[#555]"
                  )}>
                    {isBulkSelected || anyBulkSelected ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      getInitials(customerName)
                    )}
                  </div>
                  {groupStatus === "unread" && !isSelected && !isBulkSelected && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#6B2D8B] border-2 border-[#F8F8FA]" />
                  )}
                </div>
              ) : (
                // Tickets suivants : pas d'avatar, juste un espace aligné
                <div className="w-9 shrink-0 flex justify-center pt-1">
                  <div className={cn("w-[3px] h-[3px] rounded-full", isSelected ? "bg-white/40" : "bg-[#D4D4D8]")} />
                </div>
              )}

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                {/* Ligne 1 : Nom + badges (uniquement premier ticket) */}
                {isFirst && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={cn(
                      "text-[13px] font-semibold truncate",
                      isSelected ? "text-white" : "text-foreground"
                    )}>
                      {customerName}
                    </span>
                    {hasMultiple && (
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                        isSelected ? "bg-white/20 text-white" : "bg-[#6B2D8B]/10 text-[#6B2D8B]"
                      )}>
                        {tickets.length}
                      </span>
                    )}
                    {ticketLabel === "urgent" && (
                      <Flame className={cn("h-3 w-3 shrink-0", isSelected ? "text-red-300" : "text-red-500")} />
                    )}
                    {ticketLabel === "en_attente" && (
                      <Clock className={cn("h-3 w-3 shrink-0", isSelected ? "text-amber-300" : "text-amber-500")} />
                    )}
                    {groupStatus === "replied" && (
                      <span className={cn(
                        "text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5",
                        isSelected ? "bg-white/20 text-white" : "bg-[#ECFDF5] text-[#047B5D]"
                      )}>
                        <Check className="h-2.5 w-2.5" />
                        Répondu
                      </span>
                    )}
                  </div>
                )}

                {/* Ligne 2 : Sujet du ticket */}
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    "text-[12px] truncate",
                    isSelected ? "text-white/90 font-medium"
                      : ticketStatus === "unread" ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}>
                    {ticket.subject || "Sans objet"}
                  </p>
                  {q && ticket.status === "closed" && (
                    <span className="text-[9px] font-medium text-muted-foreground bg-[#F0F0F0] px-1 py-0.5 rounded shrink-0">Fermé</span>
                  )}
                </div>

                {/* Ligne 3 : Meta (messages count, priorité, date) */}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "text-[10px]",
                    isSelected ? "text-white/50" : "text-muted-foreground/60"
                  )}>
                    #{ticket.id} · {ticket.messages_count} msg
                  </span>
                  {ticket.priority && (ticket.priority === "urgent" || ticket.priority === "high") && (
                    <span className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                      isSelected
                        ? "bg-white/20 text-white"
                        : ticket.priority === "urgent" ? "bg-[#FEE8EB] text-[#C70A24]" : "bg-[#FFF5E1] text-[#8A6116]"
                    )}>
                      {ticket.priority === "urgent" ? "Urgent" : "Haute"}
                    </span>
                  )}
                  {!isFirst && ticketLabel === "urgent" && (
                    <Flame className={cn("h-2.5 w-2.5 shrink-0", isSelected ? "text-red-300" : "text-red-500")} />
                  )}
                  {!isFirst && ticketLabel === "en_attente" && (
                    <Clock className={cn("h-2.5 w-2.5 shrink-0", isSelected ? "text-amber-300" : "text-amber-500")} />
                  )}
                  <span className={cn(
                    "text-[10px] ml-auto shrink-0",
                    isSelected ? "text-white/50" : "text-muted-foreground/50"
                  )}>
                    {timeAgo(lastDate)}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  /** Single ticket row for spam/closed flat lists */
  function TicketRow({ ticket }: { ticket: GorgiasTicket }) {
    const isSelected = ticket.id === selectedTicketId
    const customerName = ticket.customer.name || ticket.customer.email.split("@")[0]
    const lastDate = ticket.last_message_datetime || ticket.updated_datetime

    return (
      <button
        onClick={() => handleSelectTicket(ticket)}
        className={cn(
          "w-full text-left px-4 py-3.5 transition-all",
          isSelected
            ? "bg-[#F3EAFA] border-l-[3px] border-l-[#6B2D8B]"
            : "hover:bg-[#FAFAFA] border-l-[3px] border-l-transparent"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold mt-0.5",
            isSelected ? "bg-[#6B2D8B] text-white" : "bg-[#F0F0F0] text-[#666]"
          )}>
            {getInitials(customerName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "text-[13px] truncate",
                isSelected ? "font-semibold text-[#6B2D8B]" : "font-medium text-foreground"
              )}>
                {customerName}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(lastDate)}</span>
            </div>
            <p className="text-[12px] text-muted-foreground truncate mt-0.5">
              {ticket.subject || "Sans objet"}
            </p>
          </div>
        </div>
      </button>
    )
  }

  /** Spam folder section */
  function SpamSection({ label, tickets, open, onToggle, color, textColor, icon: Icon }: {
    label: string; tickets: GorgiasTicket[]; open: boolean; onToggle: () => void; color: string; textColor?: string; icon?: React.ComponentType<{ className?: string }>
  }) {
    if (tickets.length === 0) return null
    const IconComp = Icon || Package
    const tc = textColor || "#8A6116"
    return (
      <div>
        <button
          onClick={onToggle}
          className="w-full px-4 py-2 flex items-center justify-between hover:opacity-80 transition-colors"
          style={{ backgroundColor: color }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tc }}>
            <IconComp className="h-3 w-3" />
            {label} · {tickets.length}
          </span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ color: tc, transform: open ? "rotate(180deg)" : undefined }} />
        </button>
        {open && (
          <div className="divide-y divide-border/50 opacity-60">
            {tickets.map(ticket => <TicketRow key={ticket.id} ticket={ticket} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen -m-6 lg:-m-8">
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ═══ LEFT: Ticket list ═══ */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-[#E4E4E7]/80 bg-[#F8F8FA]">
          <div className="px-4 py-3 border-b border-border space-y-2.5">
            {/* Mode toggle: Tickets / SMS */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-[#F5F5F5] rounded-lg p-0.5">
                <button
                  onClick={() => { setSidebarMode("tickets"); setSelectedSmsPhone(null) }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors",
                    sidebarMode === "tickets"
                      ? "bg-white text-[#6B2D8B] shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Tickets
                  {openTickets.length > 0 && sidebarMode === "tickets" && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#6B2D8B] text-white text-[10px] font-semibold flex items-center justify-center">
                      {openTickets.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setSidebarMode("sms"); setSelectedTicketId(null) }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors",
                    sidebarMode === "sms"
                      ? "bg-white text-green-600 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  SMS
                </button>
              </div>
              <div className="flex items-center gap-0.5">
                {sidebarMode === "tickets" && (
                  <>
                    <button
                      onClick={() => setComposeOpen(true)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-[#6B2D8B] hover:bg-[#F3EAFA] transition-colors"
                      title="Nouveau message"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={downloadWeeklyRecap}
                      disabled={recapLoading}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-[#E67C00] hover:bg-[#FFF1E3] transition-colors"
                      title="Récap de la semaine (.md)"
                    >
                      <FileDown className={cn("h-4 w-4", recapLoading && "animate-pulse")} />
                    </button>
                  </>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[#F0F0F0] transition-colors"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              {sidebarMode === "tickets" ? (
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un ticket..."
                  className="w-full h-8 pl-8 pr-3 text-[12px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                />
              ) : (
                <input
                  type="text"
                  value={smsSearchQuery}
                  onChange={(e) => setSmsSearchQuery(e.target.value)}
                  placeholder="Rechercher par numéro..."
                  className="w-full h-8 pl-8 pr-3 text-[12px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                />
              )}
            </div>

            {/* Badge tabs — hidden during search */}
            {!ticketsLoading && !q && filteredOpen.length > 0 && (
              <div className="flex gap-1.5 px-1 pt-2">
                <button
                  onClick={() => { setActiveTab("all"); setSelectedTicketIds(new Set()) }}
                  className={cn(
                    "flex-1 h-7 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1",
                    activeTab === "all"
                      ? "bg-[#6B2D8B]/10 text-[#6B2D8B]"
                      : "text-muted-foreground hover:bg-[#F0F0F0]"
                  )}
                >
                  À traiter
                  <span className={cn(
                    "text-[10px] px-1 rounded-full",
                    activeTab === "all" ? "bg-[#6B2D8B]/15" : "bg-[#F0F0F0]"
                  )}>{filteredOpen.length}</span>
                </button>
                <button
                  onClick={() => { setActiveTab("urgent"); setSelectedTicketIds(new Set()) }}
                  className={cn(
                    "flex-1 h-7 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1",
                    activeTab === "urgent"
                      ? "bg-red-50 text-red-600"
                      : "text-muted-foreground hover:bg-[#F0F0F0]"
                  )}
                >
                  <Flame className="h-3 w-3" />
                  Urgent
                  {urgentTickets.length > 0 && (
                    <span className={cn(
                      "text-[10px] px-1 rounded-full",
                      activeTab === "urgent" ? "bg-red-100" : "bg-[#F0F0F0]"
                    )}>{urgentTickets.length}</span>
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab("en_attente"); setSelectedTicketIds(new Set()) }}
                  className={cn(
                    "flex-1 h-7 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1",
                    activeTab === "en_attente"
                      ? "bg-amber-50 text-amber-600"
                      : "text-muted-foreground hover:bg-[#F0F0F0]"
                  )}
                >
                  <Clock className="h-3 w-3" />
                  Attente
                  {enAttenteTickets.length > 0 && (
                    <span className={cn(
                      "text-[10px] px-1 rounded-full",
                      activeTab === "en_attente" ? "bg-amber-100" : "bg-[#F0F0F0]"
                    )}>{enAttenteTickets.length}</span>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── SMS conversation list ── */}
            {sidebarMode === "sms" ? (
              smsLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* New SMS button */}
                  <button
                    onClick={() => { setSelectedSmsPhone(null); setSmsNewNumber(""); setSmsReplyText("") }}
                    className="w-full px-4 py-2.5 border-b border-border/50 flex items-center gap-2 text-[12px] font-medium text-green-600 hover:bg-green-50/50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nouveau SMS
                  </button>
                  {(() => {
                    const sq = smsSearchQuery.toLowerCase().trim()
                    const filtered = sq
                      ? smsConversations.filter(c => c.phoneNumber.includes(sq) || c.lastMessage.toLowerCase().includes(sq))
                      : smsConversations
                    return filtered.length > 0 ? (
                      <div className="divide-y divide-border/50">
                        {filtered.map(conv => {
                          const isSelected = conv.phoneNumber === selectedSmsPhone
                          return (
                            <button
                              key={conv.phoneNumber}
                              onClick={() => { setSelectedSmsPhone(conv.phoneNumber); setSmsReplyText("") }}
                              className={cn(
                                "w-full text-left px-4 py-3 transition-all border-l-[3px]",
                                isSelected
                                  ? "border-l-green-500 bg-green-50/60"
                                  : "border-l-transparent hover:bg-[#FAFAFA]"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-semibold",
                                  isSelected ? "bg-green-500 text-white" :
                                    smsCustomerCache[conv.phoneNumber] ? "bg-green-100 text-green-700" : "bg-green-50 text-green-600"
                                )}>
                                  {smsCustomerCache[conv.phoneNumber]
                                    ? getInitials(smsCustomerCache[conv.phoneNumber])
                                    : <Phone className="h-3.5 w-3.5" />
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={cn(
                                      "text-[13px] truncate",
                                      isSelected ? "font-semibold text-green-700" :
                                        conv.lastDirection === "in" ? "font-semibold text-foreground" : "font-medium text-foreground"
                                    )}>
                                      {smsCustomerCache[conv.phoneNumber] || formatSmsPhone(conv.phoneNumber)}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(conv.lastDate)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {conv.lastDirection === "out" && (
                                      <span className="text-[10px] text-green-500 shrink-0">→</span>
                                    )}
                                    <p className={cn(
                                      "text-[12px] truncate",
                                      conv.lastDirection === "in" ? "text-foreground font-medium" : "text-muted-foreground"
                                    )}>
                                      {conv.lastMessage}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {smsCustomerCache[conv.phoneNumber] ? `${formatSmsPhone(conv.phoneNumber)} · ` : ""}
                                    {conv.messageCount} msg
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                          <MessageSquare className="h-5 w-5 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {sq ? "Aucun résultat" : "Aucun SMS"}
                        </p>
                      </div>
                    )
                  })()}
                </>
              )
            ) : ticketsLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : q ? (
              /* ── Search results view (unified: open + closed + deep search) ── */
              <>
                {groupedSearch.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {groupedSearch.map(group => {
                      const allClosed = group.every(t => t.status === "closed")
                      return (
                        <div key={group[0].customer.email} className={allClosed ? "opacity-60" : ""}>
                          <TicketGroup tickets={group} />
                          {allClosed && (
                            <div className="px-4 -mt-1 mb-1">
                              <span className="text-[9px] font-medium text-muted-foreground bg-[#F0F0F0] px-1.5 py-0.5 rounded-full">
                                Fermé
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : !deepSearching ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center mb-3">
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Aucun résultat</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Essaie avec un email ou un nom complet</p>
                  </div>
                ) : null}
                {deepSearching && (
                  <div className="flex items-center justify-center py-3 gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Recherche dans l&apos;historique Gorgias...</span>
                  </div>
                )}
              </>
            ) : filteredOpen.length === 0 && filteredClosed.length === 0 && filteredChronoSpam.length === 0 && filteredTrackSpam.length === 0 && filteredBouncedSpam.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center mb-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Aucun ticket</p>
              </div>
            ) : (
              /* ── Normal sectioned view ── */
              <>
                {tabbedOpen.length > 0 && (
                  <div>
                    <div className="divide-y divide-border/50">
                      {groupedOpen.map(group => (
                        <TicketGroup key={group[0].customer.email} tickets={group} />
                      ))}
                    </div>
                  </div>
                )}
                {tabbedOpen.length === 0 && activeTab !== "all" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center mb-2">
                      {activeTab === "urgent" ? <Flame className="h-4 w-4 text-muted-foreground" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Aucun ticket {activeTab === "urgent" ? "urgent" : "en attente"}
                    </p>
                  </div>
                )}

                <SpamSection
                  label="Chronopost - Spam"
                  tickets={filteredChronoSpam}
                  open={showChronoSpam}
                  onToggle={() => setShowChronoSpam(v => !v)}
                  color="#FFF8F0"
                />

                <SpamSection
                  label="17Track - Spam"
                  tickets={filteredTrackSpam}
                  open={showTrackSpam}
                  onToggle={() => setShowTrackSpam(v => !v)}
                  color="#F0F8FF"
                />

                <SpamSection
                  label="Bounced - Spam"
                  tickets={filteredBouncedSpam}
                  open={showBouncedSpam}
                  onToggle={() => setShowBouncedSpam(v => !v)}
                  color="#FFF0F0"
                  textColor="#991B1B"
                  icon={Mail}
                />

                {filteredClosed.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowClosed(v => !v)}
                      className="w-full px-4 py-2 bg-[#FAFAFA] flex items-center justify-between hover:bg-[#F0F0F0] transition-colors"
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Fermés · {filteredClosed.length}
                      </span>
                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showClosed && "rotate-180")} />
                    </button>
                    {showClosed && (
                      <div className="divide-y divide-border/50 opacity-60">
                        {groupedClosed.map(group => (
                          <TicketGroup key={group[0].customer.email} tickets={group} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedTicketIds.size > 0 && (
            <div className="border-t border-border bg-white px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">
                  {selectedTicketIds.size} sélectionné{selectedTicketIds.size > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setSelectedTicketIds(new Set())}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[#F0F0F0] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleBulkClose}
                  disabled={bulkClosing}
                  className="flex-1 h-7 rounded-md text-[11px] font-medium bg-[#FEE8EB] text-[#C70A24] hover:bg-[#FDDDE0] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {bulkClosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                  Fermer
                </button>
                {activeTab !== "urgent" && (
                  <button
                    onClick={() => handleBulkLabel("urgent")}
                    className="flex-1 h-7 rounded-md text-[11px] font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <Flame className="h-3 w-3" />
                    Urgent
                  </button>
                )}
                {activeTab !== "en_attente" && (
                  <button
                    onClick={() => handleBulkLabel("en_attente")}
                    className="flex-1 h-7 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Attente
                  </button>
                )}
                {activeTab !== "all" && (
                  <button
                    onClick={() => handleBulkRemoveLabel()}
                    className="flex-1 h-7 rounded-md text-[11px] font-medium bg-[#F0F0F0] text-muted-foreground hover:bg-[#E5E5E5] transition-colors flex items-center justify-center gap-1"
                  >
                    À traiter
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Conversation ═══ */}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col bg-gradient-to-b from-[#FAFAFA] to-[#F4F4F5] min-w-0">
            {/* ── SMS Thread View ── */}
            {sidebarMode === "sms" ? (
              !selectedSmsConversation && !smsNewNumber && selectedSmsPhone === null ? (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <div className="w-16 h-16 rounded-2xl bg-white border border-border flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <MessageSquare className="h-7 w-7 text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Sélectionne une conversation</p>
                    <p className="text-[12px] text-muted-foreground/60 mt-1">ou envoie un nouveau SMS</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* SMS Header */}
                  <div className="bg-white border-b border-border shrink-0">
                    <div className="px-4 py-3 flex items-center gap-3">
                      <button
                        onClick={() => { setSelectedSmsPhone(null); setSmsNewNumber("") }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-[#F0F0F0] transition-colors sm:hidden"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold",
                        smsCustomer?.found ? "bg-green-500 text-white" : "bg-green-50 text-green-600"
                      )}>
                        {smsCustomer?.found && smsCustomer.customer
                          ? getInitials(`${smsCustomer.customer.firstName} ${smsCustomer.customer.lastName}`)
                          : <Phone className="h-4 w-4" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        {selectedSmsConversation ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold truncate">
                                {smsCustomer?.found && smsCustomer.customer
                                  ? `${smsCustomer.customer.firstName} ${smsCustomer.customer.lastName}`.trim()
                                  : formatSmsPhone(selectedSmsConversation.phoneNumber)
                                }
                              </span>
                              {smsCustomerLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                            <p className="text-[12px] text-muted-foreground truncate">
                              {smsCustomer?.found
                                ? `${formatSmsPhone(selectedSmsConversation.phoneNumber)} · ${smsCustomer.customer?.email || ""}`
                                : `${selectedSmsConversation.messageCount} message${selectedSmsConversation.messageCount > 1 ? "s" : ""}`
                              }
                            </p>
                          </>
                        ) : (
                          <span className="text-[14px] font-semibold">Nouveau SMS</span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Customer context bar — same as ticket view */}
                  <div className="px-4 py-2 bg-[#FAFAFA] border-b border-border shrink-0">
                    {smsCustomerLoading ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ) : smsCustomer?.found && smsCustomer.customer ? (
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Orders + total spent */}
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <ShoppingBag className="h-3.5 w-3.5 text-[#6B2D8B]" />
                          <span className="font-medium">{smsCustomer.customer.numberOfOrders}</span>
                          <span className="text-muted-foreground">commande{smsCustomer.customer.numberOfOrders > 1 ? "s" : ""}</span>
                          <span className="text-muted-foreground">· <span className="font-medium text-foreground">{parseFloat(smsCustomer.customer.totalSpent).toFixed(0)}€</span> dépensés</span>
                        </div>

                        {/* Last order link to Shopify admin */}
                        {(() => {
                          const last = smsCustomer.orders[0]
                          if (!last) return null
                          const adminId = last.id.replace("gid://shopify/Order/", "")
                          return (
                            <>
                              <a
                                href={`https://admin.shopify.com/store/grainedelascars/orders/${adminId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[12px] text-[#6B2D8B] hover:underline"
                              >
                                <span className="font-medium">{last.name}</span>
                                <span className="text-muted-foreground">
                                  ({last.totalPrice}€ · {new Date(last.createdAt).toLocaleDateString("fr-FR")})
                                </span>
                                <ExternalLink className="h-3 w-3" />
                              </a>

                              {last.fulfillmentStatus && (
                                <span className={cn(
                                  "text-[11px] font-medium px-1.5 py-0.5 rounded",
                                  last.fulfillmentStatus === "FULFILLED" ? "bg-[#ECFDF5] text-[#047B5D]" :
                                  last.fulfillmentStatus === "UNFULFILLED" ? "bg-[#FFF5E1] text-[#8A6116]" :
                                  "bg-[#F0F0F0] text-muted-foreground"
                                )}>
                                  {last.fulfillmentStatus === "FULFILLED" ? "Expédiée" :
                                   last.fulfillmentStatus === "UNFULFILLED" ? "Non expédiée" :
                                   last.fulfillmentStatus}
                                </span>
                              )}

                              {last.trackingNumber && (
                                <div className="flex items-center gap-1.5 text-[12px]">
                                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                  {last.trackingUrl ? (
                                    <a href={last.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B2D8B] hover:underline font-mono">
                                      {last.trackingNumber}
                                    </a>
                                  ) : (
                                    <span className="font-mono text-muted-foreground">{last.trackingNumber}</span>
                                  )}
                                </div>
                              )}

                              {smsCustomer.customer!.countryCode && (
                                <span className="text-[13px]" title={smsCustomer.customer!.countryCode}>
                                  {countryFlag(smsCustomer.customer!.countryCode)}
                                </span>
                              )}
                            </>
                          )
                        })()}

                        {/* Email link */}
                        {smsCustomer.customer.email && (
                          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{smsCustomer.customer.email}</span>
                          </div>
                        )}

                        {/* City */}
                        {smsCustomer.customer.city && (
                          <span className="text-[12px] text-muted-foreground">{smsCustomer.customer.city}</span>
                        )}

                        {/* Tags */}
                        {smsCustomer.customer.tags.length > 0 && smsCustomer.customer.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] font-medium text-muted-foreground bg-[#F0F0F0] px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}

                        {/* Shopify customer link */}
                        {(() => {
                          const customerId = smsCustomer.customer!.id.replace("gid://shopify/Customer/", "")
                          return (
                            <a
                              href={`https://admin.shopify.com/store/grainedelascars/customers/${customerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-[#6B2D8B] transition-colors"
                              title="Voir client Shopify"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )
                        })()}
                      </div>
                    ) : smsCustomer && !smsCustomer.found && selectedSmsConversation ? (
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Client non trouvé sur Shopify
                      </div>
                    ) : !selectedSmsConversation ? (
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        Nouveau SMS
                      </div>
                    ) : null}
                  </div>

                  {/* SMS Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {!selectedSmsConversation && (
                      <div className="mb-4">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Numéro</label>
                        <input
                          type="tel"
                          value={smsNewNumber}
                          onChange={(e) => setSmsNewNumber(e.target.value)}
                          placeholder="+33 6 12 34 56 78"
                          className="w-full h-9 px-3 text-[13px] bg-white border border-border rounded-lg focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400/30 transition-colors"
                        />
                      </div>
                    )}

                    {selectedSmsConversation && [...selectedSmsConversation.messages].reverse().map(msg => (
                      <div key={msg.id} className={cn("flex", msg.direction === "out" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                          msg.direction === "out"
                            ? "bg-green-500 text-white rounded-br-md"
                            : "bg-white border border-border text-foreground rounded-bl-md"
                        )}>
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            msg.direction === "out" ? "text-green-100" : "text-muted-foreground"
                          )}>
                            {new Date(msg.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={smsEndRef} />
                  </div>

                  {/* SMS Reply box */}
                  <div className="border-t border-border bg-white px-4 py-3 shrink-0">
                    <div className="flex gap-2">
                      <Textarea
                        value={smsReplyText}
                        onChange={(e) => setSmsReplyText(e.target.value)}
                        placeholder="Écrire un SMS..."
                        className="flex-1 min-h-[44px] max-h-[120px] text-[13px] resize-none border-border focus-visible:ring-green-400/30 focus-visible:border-green-400"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSmsSend()
                          }
                        }}
                      />
                      <Button
                        onClick={handleSmsSend}
                        disabled={smsSending || !smsReplyText.trim() || (!selectedSmsPhone && !smsNewNumber.trim())}
                        size="sm"
                        className="h-[44px] px-4 bg-green-500 hover:bg-green-600 text-white shrink-0"
                      >
                        {smsSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Entrée pour envoyer · Shift+Entrée nouvelle ligne</p>
                  </div>
                </>
              )
            ) : !selectedTicket ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <div className="w-16 h-16 rounded-3xl bg-white/80 backdrop-blur border border-[#E4E4E7]/60 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-black/[0.03]">
                    <Mail className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-[14px] font-medium text-muted-foreground/80">Sélectionne un ticket</p>
                  <p className="text-[12px] text-muted-foreground/40 mt-1">
                    {openTickets.length > 0
                      ? `${openTickets.length} ticket${openTickets.length > 1 ? "s" : ""} à traiter`
                      : "Aucun ticket ouvert"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Ticket header */}
                <div className="px-5 py-3.5 bg-white/80 backdrop-blur-sm border-b border-[#E4E4E7]/60 flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F3EAFA] to-[#E8D5F5] flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-[12px] font-bold text-[#6B2D8B]">
                      {getInitials(selectedTicket.customer.name || selectedTicket.customer.email)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold truncate">
                        {selectedTicket.customer.name || selectedTicket.customer.email}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60 hidden sm:inline">
                        {selectedTicket.customer.email}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                      {selectedTicket.subject || "Sans objet"}
                      <span className="text-muted-foreground/40 ml-1.5">#{selectedTicket.id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAiChatOpen(v => !v)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all",
                        aiChatOpen
                          ? "bg-gradient-to-r from-[#6B2D8B]/10 to-[#7C3AED]/10 text-[#6B2D8B]"
                          : "text-muted-foreground hover:text-[#6B2D8B] hover:bg-[#F3EAFA]"
                      )}
                      title="Chat IA interne"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Claude
                    </button>
                    {selectedTicket.status === "open" && (
                      <button
                        onClick={handleCloseTicket}
                        disabled={closing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-muted-foreground hover:text-[#C70A24] hover:bg-[#FEE8EB] transition-colors"
                      >
                        {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Fermer
                      </button>
                    )}
                    <a
                      href={`https://grainedelascars.gorgias.com/app/ticket/${selectedTicket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/[0.04] transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Customer context bar */}
                <div className="px-4 py-2 bg-[#FAFAFA] border-b border-border shrink-0">
                  {ordersLoading ? (
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ) : customerOrders && customerOrders.orders.length > 0 ? (
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[12px]">
                        <ShoppingBag className="h-3.5 w-3.5 text-[#6B2D8B]" />
                        <span className="font-medium">{customerOrders.totalOrders}</span>
                        <span className="text-muted-foreground">commande{customerOrders.totalOrders > 1 ? "s" : ""}</span>
                        {customerOrders.totalSpent && (
                          <span className="text-muted-foreground">· <span className="font-medium text-foreground">{parseFloat(customerOrders.totalSpent).toFixed(0)}€</span> dépensés</span>
                        )}
                      </div>

                      {(() => {
                        const last = customerOrders.orders[0]
                        if (!last) return null
                        const adminId = last.id.replace("gid://shopify/Order/", "")
                        return (
                          <>
                            <a
                              href={`https://admin.shopify.com/store/grainedelascars/orders/${adminId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[12px] text-[#6B2D8B] hover:underline"
                            >
                              <span className="font-medium">{last.name}</span>
                              <span className="text-muted-foreground">
                                ({last.totalPrice}€ · {new Date(last.createdAt).toLocaleDateString("fr-FR")})
                              </span>
                              <ExternalLink className="h-3 w-3" />
                            </a>

                            {last.fulfillmentStatus && (
                              <span className={cn(
                                "text-[11px] font-medium px-1.5 py-0.5 rounded",
                                last.fulfillmentStatus === "FULFILLED" ? "bg-[#ECFDF5] text-[#047B5D]" :
                                last.fulfillmentStatus === "UNFULFILLED" ? "bg-[#FFF5E1] text-[#8A6116]" :
                                "bg-[#F0F0F0] text-muted-foreground"
                              )}>
                                {last.fulfillmentStatus === "FULFILLED" ? "Expédiée" :
                                 last.fulfillmentStatus === "UNFULFILLED" ? "Non expédiée" :
                                 last.fulfillmentStatus}
                              </span>
                            )}

                            {last.trackingNumber && (
                              <div className="flex items-center gap-1.5 text-[12px]">
                                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                {last.trackingUrl ? (
                                  <a href={last.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B2D8B] hover:underline font-mono">
                                    {last.trackingNumber}
                                  </a>
                                ) : (
                                  <span className="font-mono text-muted-foreground">{last.trackingNumber}</span>
                                )}
                              </div>
                            )}

                            {last.countryCode && (
                              <span className="text-[13px]" title={last.countryCode}>
                                {countryFlag(last.countryCode)}
                              </span>
                            )}

                            {last.photoUrl && (
                              <button
                                onClick={() => setPhotoLightbox(last.photoUrl)}
                                className="flex items-center gap-1 text-[12px] text-[#6B2D8B] hover:text-[#5A2376] transition-colors"
                                title="Voir photo commande"
                              >
                                <Camera className="h-3.5 w-3.5" />
                                <span className="font-medium">Photo</span>
                              </button>
                            )}
                          </>
                        )
                      })()}

                      {joyPoints?.found && (
                        <div className="relative" ref={joyDropdownRef}>
                          <button
                            onClick={() => setJoyDropdownOpen(v => !v)}
                            className={cn(
                              "flex items-center gap-1.5 text-[12px] transition-colors",
                              joyDropdownOpen
                                ? "text-[#B45309]"
                                : "text-[#D97706] hover:text-[#B45309]"
                            )}
                          >
                            <Star className="h-3.5 w-3.5" />
                            <span className="font-medium">{joyPoints.points}</span>
                            <span className="opacity-70">pts Joy</span>
                            <ChevronDown className={cn("h-3 w-3 transition-transform", joyDropdownOpen && "rotate-180")} />
                          </button>

                          {joyDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1.5 w-[260px] bg-white rounded-xl border border-border shadow-lg z-50 overflow-hidden">
                              {/* Header */}
                              <div className="px-3.5 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A]/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Star className="h-3.5 w-3.5 text-[#D97706]" />
                                    <span className="text-[13px] font-semibold text-[#92400E]">{joyPoints.points} points</span>
                                  </div>
                                  <a
                                    href={joyPoints.joyId
                                      ? `https://admin.shopify.com/store/grainedelascars/apps/loyaltify-loyalty-program/embed/customers/profile/${joyPoints.joyId}`
                                      : `https://admin.shopify.com/store/grainedelascars/apps/loyaltify-loyalty-program/embed/customers`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-[#D97706] hover:text-[#B45309] flex items-center gap-1 transition-colors"
                                  >
                                    Voir Joy <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                                {joyPoints.tier && (
                                  <p className="text-[11px] text-[#92400E]/60 mt-0.5">Tier: {joyPoints.tier}</p>
                                )}
                              </div>

                              {/* Add points */}
                              <div className="px-3.5 py-2.5 border-b border-border">
                                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Ajouter des points</p>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    value={joyAddPoints}
                                    onChange={(e) => setJoyAddPoints(e.target.value)}
                                    placeholder="Ex: 50"
                                    className="flex-1 h-7 px-2 text-[12px] bg-[#F5F5F5] border border-transparent rounded-md focus:bg-white focus:border-border focus:outline-none transition-colors"
                                  />
                                  <button
                                    onClick={() => {
                                      const pts = parseInt(joyAddPoints)
                                      if (pts > 0) handleJoyAction("award", pts)
                                    }}
                                    disabled={joyActionLoading || !joyAddPoints || parseInt(joyAddPoints) <= 0}
                                    className="h-7 px-2.5 rounded-md bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-medium disabled:opacity-40 transition-colors flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Ajouter
                                  </button>
                                </div>
                              </div>

                              {/* Expired points info + restore */}
                              <div className="px-3.5 py-2 border-b border-border">
                                {joyExpiredLoading ? (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Vérification points expirés...
                                  </div>
                                ) : joyExpired ? (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground">Dernière expiration :</span>
                                        <span className="font-semibold text-[#DC2626]">-{joyExpired.points} pts</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground/60">
                                        {new Date(joyExpired.date).toLocaleDateString("fr-FR")}
                                      </span>
                                    </div>
                                    <button
                                      onClick={handleRestoreExpired}
                                      disabled={joyActionLoading}
                                      className="mt-1.5 w-full h-7 rounded-md bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Rétablir {joyExpired.points} pts
                                    </button>
                                  </>
                                ) : joyExpiredChecked ? (
                                  <p className="text-[11px] text-muted-foreground/50">Aucun point expiré</p>
                                ) : null}
                              </div>

                              {/* Cashback redeem */}
                              <div className="py-1">
                                {joyRedeemCode ? (
                                  <div className="px-3.5 py-2.5">
                                    <p className="text-[11px] font-medium text-green-700 mb-1.5 flex items-center gap-1.5">
                                      <Check className="h-3 w-3" />
                                      Code promo créé ({joyRedeemCode.pointsUsed} pts utilisés)
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <code className="flex-1 h-8 px-2.5 bg-green-50 border border-green-200 rounded-md text-[13px] font-mono font-semibold text-green-800 flex items-center select-all">
                                        {joyRedeemCode.code}
                                      </code>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(joyRedeemCode.code)
                                          toast.success("Code copié !")
                                        }}
                                        className="h-8 px-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copier
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleJoyAction("redeem")}
                                    disabled={joyActionLoading || joyPoints.points < 10}
                                    className="w-full px-3.5 py-2 text-left text-[12px] hover:bg-[#F5F5F5] transition-colors flex items-center gap-2 disabled:opacity-40"
                                  >
                                    <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Cashback (10 pts = 1€)</span>
                                    {joyPoints.points >= 10 && (
                                      <span className="ml-auto text-[10px] text-muted-foreground">
                                        → {Math.floor(joyPoints.points / 10)}€ max
                                      </span>
                                    )}
                                  </button>
                                )}
                              </div>

                              {joyActionLoading && (
                                <div className="px-3.5 py-2 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Traitement...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : customerOrders ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Aucune commande Shopify
                      </div>
                      {joyPoints?.found && (
                        <div className="relative" ref={joyDropdownRef}>
                          <button
                            onClick={() => setJoyDropdownOpen(v => !v)}
                            className={cn(
                              "flex items-center gap-1.5 text-[12px] transition-colors",
                              joyDropdownOpen
                                ? "text-[#B45309]"
                                : "text-[#D97706] hover:text-[#B45309]"
                            )}
                          >
                            <Star className="h-3.5 w-3.5" />
                            <span className="font-medium">{joyPoints.points}</span>
                            <span className="opacity-70">pts Joy</span>
                            <ChevronDown className={cn("h-3 w-3 transition-transform", joyDropdownOpen && "rotate-180")} />
                          </button>

                          {joyDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1.5 w-[260px] bg-white rounded-xl border border-border shadow-lg z-50 overflow-hidden">
                              {/* Header */}
                              <div className="px-3.5 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A]/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Star className="h-3.5 w-3.5 text-[#D97706]" />
                                    <span className="text-[13px] font-semibold text-[#92400E]">{joyPoints.points} points</span>
                                  </div>
                                  <a
                                    href={joyPoints.joyId
                                      ? `https://admin.shopify.com/store/grainedelascars/apps/loyaltify-loyalty-program/embed/customers/profile/${joyPoints.joyId}`
                                      : `https://admin.shopify.com/store/grainedelascars/apps/loyaltify-loyalty-program/embed/customers`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-[#D97706] hover:text-[#B45309] flex items-center gap-1 transition-colors"
                                  >
                                    Voir Joy <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                                {joyPoints.tier && (
                                  <p className="text-[11px] text-[#92400E]/60 mt-0.5">Tier: {joyPoints.tier}</p>
                                )}
                              </div>

                              {/* Add points */}
                              <div className="px-3.5 py-2.5 border-b border-border">
                                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Ajouter des points</p>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    value={joyAddPoints}
                                    onChange={(e) => setJoyAddPoints(e.target.value)}
                                    placeholder="Ex: 50"
                                    className="flex-1 h-7 px-2 text-[12px] bg-[#F5F5F5] border border-transparent rounded-md focus:bg-white focus:border-border focus:outline-none transition-colors"
                                  />
                                  <button
                                    onClick={() => {
                                      const pts = parseInt(joyAddPoints)
                                      if (pts > 0) handleJoyAction("award", pts)
                                    }}
                                    disabled={joyActionLoading || !joyAddPoints || parseInt(joyAddPoints) <= 0}
                                    className="h-7 px-2.5 rounded-md bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-medium disabled:opacity-40 transition-colors flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Ajouter
                                  </button>
                                </div>
                              </div>

                              {/* Expired points info + restore */}
                              <div className="px-3.5 py-2 border-b border-border">
                                {joyExpiredLoading ? (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Vérification points expirés...
                                  </div>
                                ) : joyExpired ? (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground">Dernière expiration :</span>
                                        <span className="font-semibold text-[#DC2626]">-{joyExpired.points} pts</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground/60">
                                        {new Date(joyExpired.date).toLocaleDateString("fr-FR")}
                                      </span>
                                    </div>
                                    <button
                                      onClick={handleRestoreExpired}
                                      disabled={joyActionLoading}
                                      className="mt-1.5 w-full h-7 rounded-md bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Rétablir {joyExpired.points} pts
                                    </button>
                                  </>
                                ) : joyExpiredChecked ? (
                                  <p className="text-[11px] text-muted-foreground/50">Aucun point expiré</p>
                                ) : null}
                              </div>

                              {/* Cashback redeem */}
                              <div className="py-1">
                                {joyRedeemCode ? (
                                  <div className="px-3.5 py-2.5">
                                    <p className="text-[11px] font-medium text-green-700 mb-1.5 flex items-center gap-1.5">
                                      <Check className="h-3 w-3" />
                                      Code promo créé ({joyRedeemCode.pointsUsed} pts utilisés)
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <code className="flex-1 h-8 px-2.5 bg-green-50 border border-green-200 rounded-md text-[13px] font-mono font-semibold text-green-800 flex items-center select-all">
                                        {joyRedeemCode.code}
                                      </code>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(joyRedeemCode.code)
                                          toast.success("Code copié !")
                                        }}
                                        className="h-8 px-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copier
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleJoyAction("redeem")}
                                    disabled={joyActionLoading || joyPoints.points < 10}
                                    className="w-full px-3.5 py-2 text-left text-[12px] hover:bg-[#F5F5F5] transition-colors flex items-center gap-2 disabled:opacity-40"
                                  >
                                    <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Cashback (10 pts = 1€)</span>
                                    {joyPoints.points >= 10 && (
                                      <span className="ml-auto text-[10px] text-muted-foreground">
                                        → {Math.floor(joyPoints.points / 10)}€ max
                                      </span>
                                    )}
                                  </button>
                                )}
                              </div>

                              {joyActionLoading && (
                                <div className="px-3.5 py-2 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Traitement...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Messages — Glass thread */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-16">Aucun message</p>
                  ) : (
                    (() => {
                      const publicMsgs = messages.filter(m => m.public)
                      return publicMsgs.map((msg, idx) => {
                        const isAgent = msg.from_agent
                        const rawBody = msg.body_text || stripHtml(msg.body_html || "")
                        const body = stripQuotedContent(rawBody)
                        const quotedPart = rawBody.slice(body.length).trim()
                        const msgDate = new Date(msg.created_datetime)
                        const senderName = msg.sender?.name || msg.sender?.email || (isAgent ? "Agent" : "Client")
                        const isFirst = idx === 0

                        const imageAttachments = (msg.attachments || [])
                          .filter(a => a.content_type?.startsWith("image/"))

                        const dateStr = msgDate.toLocaleDateString("fr-FR", {
                          weekday: "short", day: "numeric", month: "short",
                          ...(msgDate.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
                        })
                        const timeStr = msgDate.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })

                        return (
                          <div key={msg.id} className="relative">
                            {/* Connector line between messages */}
                            {!isFirst && (
                              <div className="absolute -top-4 left-6 w-px h-4 bg-gradient-to-b from-transparent to-[#E4E4E7]" />
                            )}
                            <div className={cn(
                              "rounded-2xl overflow-hidden shadow-sm transition-all",
                              isAgent
                                ? "bg-gradient-to-br from-[#FAF5FF] to-[#F3EAFA] border border-[#6B2D8B]/10"
                                : "bg-white border border-[#E4E4E7]/80"
                            )}>
                              {/* Header */}
                              <div className="flex items-center gap-2.5 px-4 py-3">
                                <div className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                  isAgent
                                    ? "bg-gradient-to-br from-[#7C3AED] to-[#6B2D8B] text-white shadow-sm shadow-[#6B2D8B]/20"
                                    : "bg-gradient-to-br from-[#F0F0F0] to-[#E4E4E7] text-[#555]"
                                )}>
                                  {senderName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "text-[12px] font-semibold truncate",
                                      isAgent ? "text-[#6B2D8B]" : "text-foreground"
                                    )}>
                                      {senderName}
                                    </span>
                                    {isAgent && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#6B2D8B] text-white font-medium shrink-0">
                                        GDL
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                                  {dateStr} · {timeStr}
                                </span>
                              </div>

                              {/* Body */}
                              <div className="px-4 pb-4 pt-0 text-[13px] leading-[1.7] text-foreground/90">
                                {body.split("\n").map((line, i) => (
                                  <p key={i} className={line.trim() === "" ? "h-3" : ""}>
                                    {line || "\u00A0"}
                                  </p>
                                ))}

                                {imageAttachments.length > 0 && (
                                  <div className={cn("flex flex-wrap gap-2", body.trim() && "mt-3")}>
                                    {imageAttachments.map((att, i) => (
                                      <button
                                        key={i}
                                        onClick={() => setPhotoLightbox(att.url)}
                                        className="block rounded-xl overflow-hidden hover:opacity-80 transition-opacity shadow-sm"
                                      >
                                        <img
                                          src={att.url}
                                          alt={att.name || `Image ${i + 1}`}
                                          className="max-w-[200px] max-h-[200px] rounded-xl object-cover"
                                          loading="lazy"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Quoted content — collapsible */}
                                {quotedPart && (
                                  <details className="mt-3 group">
                                    <summary className="text-[11px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground flex items-center gap-1.5 select-none py-1">
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/[0.04] hover:bg-black/[0.06] transition-colors">
                                        <ChevronUp className="h-3 w-3 rotate-180 group-open:rotate-0 transition-transform" />
                                        <span>Message cité</span>
                                      </div>
                                    </summary>
                                    <div className="mt-2 pl-3 border-l-2 border-[#E4E4E7] text-[12px] text-muted-foreground/70 leading-[1.5]">
                                      {quotedPart.split("\n").map((line, i) => (
                                        <p key={i} className={line.trim() === "" ? "h-2" : ""}>
                                          {line || "\u00A0"}
                                        </p>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply area */}
                <div className="bg-white/80 backdrop-blur-sm border-t border-[#E4E4E7]/80 px-5 py-4 shrink-0">
                  {sendSuccess && (
                    <div className="flex items-center gap-2 text-[12px] text-[#047B5D] bg-[#ECFDF5] rounded-xl px-3.5 py-2.5 mb-3 shadow-sm">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Email envoyé avec succès
                    </div>
                  )}
                  <Textarea
                    value={replyText}
                    onChange={(e) => { setReplyText(e.target.value); setSendSuccess(false) }}
                    placeholder="Écris ta réponse ou génère-la avec l'IA..."
                    className="min-h-[80px] text-[13px] bg-[#F8F8FA] border-[#E4E4E7] rounded-2xl resize-none focus:bg-white focus:border-[#6B2D8B]/30 focus:ring-1 focus:ring-[#6B2D8B]/10 transition-all placeholder:text-muted-foreground/40"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleGenerateReply}
                      disabled={generating || messages.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-gradient-to-r from-[#6B2D8B]/10 to-[#7C3AED]/10 text-[#6B2D8B] hover:from-[#6B2D8B]/15 hover:to-[#7C3AED]/15 transition-all disabled:opacity-40"
                    >
                      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generating ? "Génération..." : "IA"}
                    </button>
                    {replyText.trim() && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(replyText); toast.success("Copié") }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-muted-foreground hover:bg-black/[0.04] transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copier
                      </button>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-[#6B2D8B] to-[#7C3AED] text-white shadow-md shadow-[#6B2D8B]/20 hover:shadow-lg hover:shadow-[#6B2D8B]/25 transition-all disabled:opacity-40 disabled:shadow-none"
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Envoyer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ═══ AI Chat Panel ═══ */}
          {aiChatOpen && selectedTicket && (
            <div className="w-[300px] shrink-0 flex flex-col border-l border-border bg-white">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#D97706] flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-[13px] font-semibold">Assistant Claude</span>
                </div>
                <button
                  onClick={() => setAiChatOpen(false)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[#F0F0F0] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {aiChatMessages.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-5 w-5 text-[#D97706]" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground">Chat interne IA</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Pose des questions sur le ticket, envoie un point relais, demande un résumé... Claude a le contexte de la conversation et des commandes.
                  </p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {aiChatMessages.map((msg, idx) => (
                  <div key={idx} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-[1.5]",
                      msg.role === "user"
                        ? "bg-[#6B2D8B] text-white rounded-br-md"
                        : "bg-[#F5F5F5] text-[#1a1a1a] rounded-bl-md"
                    )}>
                      {msg.content.split("\n").map((line, i) => (
                        <p key={i} className={line.trim() === "" ? "h-2" : ""}>{line || "\u00A0"}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {aiChatLoading && (
                  <div className="flex items-start">
                    <div className="bg-[#F5F5F5] rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={aiChatEndRef} />
              </div>

              <div className="px-3 py-3 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiChat() } }}
                    placeholder="Demande à Claude..."
                    className="flex-1 h-9 px-3 text-[12.5px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={handleAiChat}
                    disabled={aiChatLoading || !aiChatInput.trim()}
                    className="h-9 w-9 rounded-lg bg-[#6B2D8B] hover:bg-[#5a2574] text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose email dialog */}
      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={() => fetchTickets()}
      />

      {/* Photo lightbox */}
      {photoLightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setPhotoLightbox(null)}
        >
          <button
            onClick={() => setPhotoLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <img
            src={photoLightbox}
            alt="Photo commande"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={photoLightbox}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 right-6 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[12px] font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir original
          </a>
        </div>
      )}
    </div>
  )
}
