// Gorgias API helpers

export function getGorgiasConfig() {
  const baseUrl = process.env.GORGIAS_BASE_URL
  const email = process.env.GORGIAS_API_EMAIL
  const apiKey = process.env.GORGIAS_API_KEY

  if (!baseUrl || !email || !apiKey) {
    throw new Error("GORGIAS_BASE_URL, GORGIAS_API_EMAIL, GORGIAS_API_KEY requis")
  }

  // Gorgias uses HTTP Basic Auth: email:api_key base64-encoded
  const auth = Buffer.from(`${email}:${apiKey}`).toString("base64")

  return {
    baseUrl: baseUrl.replace(/\/$/, ""), // Remove trailing slash
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  }
}

// ─── Rate-limited fetch wrapper ───
// Gorgias API key: 40 requests / 20s window (leaky bucket)
// Retries on 429 using Retry-after header

const MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY = 5000 // 5s fallback if no Retry-after header

export async function gorgiasFetch(
  url: string,
  options: RequestInit & { headers: Record<string, string> }
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options)

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("retry-after")
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : DEFAULT_RETRY_DELAY
      const limit = res.headers.get("x-gorgias-account-api-call-limit") || "?"
      console.warn(`Gorgias 429 rate limit (${limit}), retrying in ${waitMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitMs))
      continue
    }

    return res
  }

  // Should never reach here, but just in case
  return fetch(url, options)
}

// ─── Tickets cache (server-side, in-memory) ───
// Prevents sidebar + messages page from both hitting Gorgias at the same time

interface TicketsCache {
  data: any[] | null
  fetchedAt: number
  promise: Promise<any[]> | null // in-flight deduplication
}

const ticketsCache: TicketsCache = {
  data: null,
  fetchedAt: 0,
  promise: null,
}

const TICKETS_CACHE_TTL = 30_000 // 30 seconds

export async function fetchAllTickets(maxPages = 4): Promise<any[]> {
  const now = Date.now()

  // Return cached data if fresh
  if (ticketsCache.data && now - ticketsCache.fetchedAt < TICKETS_CACHE_TTL) {
    return ticketsCache.data
  }

  // Deduplicate in-flight requests (if sidebar + page call at the same time)
  if (ticketsCache.promise) {
    return ticketsCache.promise
  }

  ticketsCache.promise = _fetchAllTicketsFromGorgias(maxPages)
    .then(tickets => {
      ticketsCache.data = tickets
      ticketsCache.fetchedAt = Date.now()
      ticketsCache.promise = null
      return tickets
    })
    .catch(err => {
      ticketsCache.promise = null
      throw err
    })

  return ticketsCache.promise
}

// Force invalidate (e.g., after closing a ticket or replying)
export function invalidateTicketsCache() {
  ticketsCache.data = null
  ticketsCache.fetchedAt = 0
}

async function _fetchAllTicketsFromGorgias(maxPages: number): Promise<any[]> {
  const { baseUrl, headers } = getGorgiasConfig()
  const perPage = 50
  const allTickets: any[] = []
  let cursor: string | null = null

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${baseUrl}/tickets`)
    url.searchParams.set("limit", String(perPage))
    url.searchParams.set("order_by", "updated_datetime:desc")
    if (cursor) {
      url.searchParams.set("cursor", cursor)
    }

    const res = await gorgiasFetch(url.toString(), { headers })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gorgias API ${res.status}: ${text}`)
    }

    const data = await res.json()
    const tickets = data.data || []
    allTickets.push(...tickets)

    cursor = data.meta?.next_cursor ?? null
    if (!cursor || tickets.length < perPage) break
  }

  return allTickets
}

// ─── Types ───

export interface GorgiasCustomer {
  id: number
  name: string
  email: string
  firstname: string
  lastname: string
}

export interface GorgiasMessageSender {
  id?: number
  name?: string
  email?: string
}

export interface GorgiasMessage {
  id: number
  ticket_id: number
  channel: string
  from_agent: boolean
  sender: GorgiasMessageSender
  receiver: GorgiasMessageSender | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  public: boolean
  created_datetime: string
  sent_datetime: string | null
  source: {
    type: string
    from?: { address: string; name?: string }
    to?: { address: string; name?: string }[]
  }
  attachments?: { url: string; name: string; content_type: string }[]
}

export interface GorgiasTag {
  id: number
  name: string
  decoration?: { color?: string }
}

export interface GorgiasTicket {
  id: number
  external_id: string | null
  subject: string | null
  status: "open" | "closed"
  priority: "urgent" | "high" | "normal" | "low" | null
  channel: string
  customer: GorgiasCustomer
  assignee_user: { id: number; name: string; email: string } | null
  assignee_team: { id: number; name: string } | null
  created_datetime: string
  updated_datetime: string
  opened_datetime: string | null
  closed_datetime: string | null
  last_message_datetime: string | null
  messages_count: number
  messages?: GorgiasMessage[]
  tags: GorgiasTag[]
  spam: boolean
  language: string | null
  via: string
}

export interface GorgiasListResponse<T> {
  data: T[]
  meta: {
    total_count: number
    limit: number
    next_cursor: string | null
    prev_cursor: string | null
  }
}
