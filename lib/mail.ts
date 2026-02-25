// Zoho IMAP/SMTP mail client — replaces Gorgias
import { ImapFlow } from "imapflow"
import { simpleParser, ParsedMail } from "mailparser"
import nodemailer from "nodemailer"
import type { SupabaseClient } from "@supabase/supabase-js"

const AGENT_EMAIL = "bonjour@grainedelascars.com"
const AGENT_NAME = "Graine de Lascars"

// ─── IMAP config ───

function getImapConfig() {
  return {
    host: process.env.ZOHO_IMAP_HOST!,
    port: Number(process.env.ZOHO_IMAP_PORT || 993),
    secure: true,
    auth: {
      user: process.env.ZOHO_IMAP_USER!,
      pass: process.env.ZOHO_IMAP_PASS!,
    },
    logger: false as const,
  }
}

// ─── SMTP config ───

function getSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST!,
    port: Number(process.env.ZOHO_SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.ZOHO_IMAP_USER!,
      pass: process.env.ZOHO_IMAP_PASS!,
    },
  })
}

// ─── Types ───

interface RawEmail {
  uid: number
  messageId: string
  inReplyTo: string | null
  references: string | null
  from: { address: string; name: string }
  to: { address: string; name: string }
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  date: Date
  attachments: { name: string; contentType: string; size: number; content: Buffer }[]
}

export interface EmailThread {
  id: string
  thread_id: string
  subject: string | null
  status: string
  customer_name: string
  customer_email: string
  last_message_at: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export interface EmailMessage {
  id: string
  thread_id: string
  message_id: string
  in_reply_to: string | null
  references: string | null
  from_email: string
  from_name: string | null
  to_email: string
  subject: string | null
  body_text: string | null
  body_html: string | null
  from_agent: boolean
  created_at: string
  uid_imap: number | null
  attachments: { name: string; content_type: string; size: number; url: string }[]
}

// ─── Mapping to frontend format ───

export function threadToTicket(thread: EmailThread) {
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status as "open" | "closed",
    priority: null,
    channel: "email",
    customer: {
      id: 0,
      name: thread.customer_name,
      email: thread.customer_email,
    },
    created_datetime: thread.created_at,
    updated_datetime: thread.updated_at,
    last_message_datetime: thread.last_message_at,
    messages_count: thread.message_count,
    tags: [] as { id: number; name: string }[],
    language: null,
    spam: false,
    via: "email",
  }
}

export function messageToGorgiasFormat(msg: EmailMessage) {
  return {
    id: msg.id,
    ticket_id: msg.thread_id,
    channel: "email",
    from_agent: msg.from_agent,
    sender: {
      name: msg.from_name || msg.from_email,
      email: msg.from_email,
    },
    body_text: msg.body_text,
    body_html: msg.body_html,
    attachments: (msg.attachments || []).map((a) => ({
      url: a.url,
      name: a.name,
      content_type: a.content_type,
      size: a.size,
    })),
    public: true,
    created_datetime: msg.created_at,
    sent_datetime: msg.created_at,
  }
}

// ─── Threading ───

function stripSubjectPrefixes(subject: string): string {
  return subject.replace(/^(Re|Fwd|Fw|TR|AW):\s*/gi, "").trim()
}

async function resolveThreadId(
  supabase: SupabaseClient,
  messageId: string,
  inReplyTo: string | null,
  references: string | null,
  subject: string
): Promise<{ threadUuid: string | null; isNew: boolean }> {
  // 1. Check In-Reply-To
  if (inReplyTo) {
    const { data } = await supabase
      .from("email_messages")
      .select("thread_id")
      .eq("message_id", inReplyTo)
      .limit(1)
      .single()
    if (data) return { threadUuid: data.thread_id, isNew: false }
  }

  // 2. Check References (last one first)
  if (references) {
    const refs = references.split(/\s+/).filter(Boolean).reverse()
    for (const ref of refs) {
      const { data } = await supabase
        .from("email_messages")
        .select("thread_id")
        .eq("message_id", ref)
        .limit(1)
        .single()
      if (data) return { threadUuid: data.thread_id, isNew: false }
    }
  }

  // 3. Fallback: match by stripped subject + same customer within 30 days
  const stripped = stripSubjectPrefixes(subject)
  if (stripped) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("email_threads")
      .select("id")
      .eq("subject", stripped)
      .gte("last_message_at", thirtyDaysAgo)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .single()
    if (data) return { threadUuid: data.id, isNew: false }
  }

  // 4. New thread
  return { threadUuid: null, isNew: true }
}

// ─── IMAP Sync ───

export async function syncInbox(
  supabase: SupabaseClient
): Promise<{ synced: number; errors: number }> {
  // Get last UID
  const { data: syncState } = await supabase
    .from("email_sync_state")
    .select("last_uid")
    .eq("id", "main")
    .single()

  const lastUid = syncState?.last_uid ?? 0

  // Connect IMAP
  const client = new ImapFlow(getImapConfig())
  await client.connect()

  let synced = 0
  let errors = 0
  let maxUid = lastUid

  try {
    const lock = await client.getMailboxLock("INBOX")

    try {
      // Fetch new emails (uid > lastUid)
      // If lastUid is 0 (first sync), fetch all
      const range = lastUid === 0 ? "1:*" : `${lastUid + 1}:*`

      const messages = client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
        bodyStructure: true,
      })

      for await (const msg of messages) {
        try {
          if (msg.uid <= lastUid) continue // skip already synced

          // Parse with mailparser
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed: ParsedMail = await (simpleParser as any)(msg.source)

          const messageId = parsed.messageId || `generated-${msg.uid}@zoho`
          const inReplyTo = parsed.inReplyTo || null
          const references = parsed.references
            ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : parsed.references)
            : null

          const fromAddr = parsed.from?.value?.[0]?.address || ""
          const fromName = parsed.from?.value?.[0]?.name || ""
          const toAddr = parsed.to
            ? (Array.isArray(parsed.to)
              ? parsed.to[0]?.value?.[0]?.address || ""
              : parsed.to.value?.[0]?.address || "")
            : ""
          const subject = parsed.subject || "(sans objet)"
          const bodyText = parsed.text || null
          const bodyHtml = parsed.html || null
          const date = parsed.date || new Date()
          const fromAgent = fromAddr.toLowerCase() === AGENT_EMAIL.toLowerCase()

          // Determine customer (the non-agent party)
          const customerEmail = fromAgent ? toAddr : fromAddr
          const customerName = fromAgent
            ? (parsed.to
              ? (Array.isArray(parsed.to)
                ? parsed.to[0]?.value?.[0]?.name || toAddr
                : parsed.to.value?.[0]?.name || toAddr)
              : toAddr)
            : (fromName || fromAddr)

          // Check if message already exists
          const { data: existing } = await supabase
            .from("email_messages")
            .select("id")
            .eq("message_id", messageId)
            .limit(1)
            .single()

          if (existing) {
            if (msg.uid > maxUid) maxUid = msg.uid
            continue // already synced
          }

          // Resolve thread
          const { threadUuid, isNew } = await resolveThreadId(
            supabase,
            messageId,
            inReplyTo,
            references,
            subject
          )

          let finalThreadUuid: string

          if (isNew || !threadUuid) {
            // Create new thread
            const strippedSubject = stripSubjectPrefixes(subject)
            const { data: newThread, error: threadErr } = await supabase
              .from("email_threads")
              .insert({
                thread_id: messageId,
                subject: strippedSubject || subject,
                status: "open",
                customer_name: customerName,
                customer_email: customerEmail.toLowerCase(),
                last_message_at: date.toISOString(),
                message_count: 1,
                created_at: date.toISOString(),
                updated_at: date.toISOString(),
              })
              .select("id")
              .single()

            if (threadErr || !newThread) {
              console.error("Failed to create thread:", threadErr)
              errors++
              continue
            }
            finalThreadUuid = newThread.id
          } else {
            finalThreadUuid = threadUuid
          }

          // Upload attachments to Supabase Storage
          const attachmentMeta: { name: string; content_type: string; size: number; url: string }[] = []
          if (parsed.attachments?.length) {
            for (const att of parsed.attachments) {
              try {
                const path = `${finalThreadUuid}/${messageId}/${att.filename || "attachment"}`
                const { error: uploadErr } = await supabase.storage
                  .from("email-attachments")
                  .upload(path, att.content, {
                    contentType: att.contentType || "application/octet-stream",
                    upsert: true,
                  })
                if (!uploadErr) {
                  const { data: urlData } = supabase.storage
                    .from("email-attachments")
                    .getPublicUrl(path)
                  attachmentMeta.push({
                    name: att.filename || "attachment",
                    content_type: att.contentType || "application/octet-stream",
                    size: att.size || 0,
                    url: urlData.publicUrl,
                  })
                }
              } catch {
                // Skip attachment upload errors
              }
            }
          }

          // Insert message
          const { error: msgErr } = await supabase
            .from("email_messages")
            .insert({
              thread_id: finalThreadUuid,
              message_id: messageId,
              in_reply_to: inReplyTo,
              references: references,
              from_email: fromAddr.toLowerCase(),
              from_name: fromName || null,
              to_email: toAddr.toLowerCase(),
              subject,
              body_text: bodyText,
              body_html: bodyHtml ? (typeof bodyHtml === 'string' ? bodyHtml : String(bodyHtml)) : null,
              from_agent: fromAgent,
              created_at: date.toISOString(),
              uid_imap: msg.uid,
              attachments: attachmentMeta,
            })

          if (msgErr) {
            console.error("Failed to insert message:", msgErr)
            errors++
            continue
          }

          // Update thread stats (if existing thread)
          if (!isNew && threadUuid) {
            // Get message count
            const { count } = await supabase
              .from("email_messages")
              .select("id", { count: "exact", head: true })
              .eq("thread_id", finalThreadUuid)

            await supabase
              .from("email_threads")
              .update({
                last_message_at: date.toISOString(),
                message_count: count || 1,
                updated_at: new Date().toISOString(),
                // Re-open thread if customer replies to a closed one
                ...(!fromAgent ? { status: "open" } : {}),
              })
              .eq("id", finalThreadUuid)
          }

          synced++
          if (msg.uid > maxUid) maxUid = msg.uid
        } catch (err) {
          console.error("Error processing message uid:", msg.uid, err)
          errors++
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  // Update sync cursor
  if (maxUid > lastUid) {
    await supabase
      .from("email_sync_state")
      .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() })
      .eq("id", "main")
  }

  return { synced, errors }
}

// ─── SMTP Send ───

export async function sendEmail(opts: {
  to: string
  toName?: string
  subject: string
  bodyText: string
  bodyHtml: string
  inReplyTo?: string
  references?: string
}): Promise<{ messageId: string }> {
  const transport = getSmtpTransport()

  const info = await transport.sendMail({
    from: `"${AGENT_NAME}" <${AGENT_EMAIL}>`,
    to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
    subject: opts.subject,
    text: opts.bodyText,
    html: opts.bodyHtml,
    ...(opts.inReplyTo ? { inReplyTo: opts.inReplyTo } : {}),
    ...(opts.references ? { references: opts.references } : {}),
  })

  return { messageId: info.messageId }
}

// ─── Send + store ───

export async function sendAndStoreReply(
  supabase: SupabaseClient,
  threadId: string,
  opts: {
    to: string
    toName?: string
    subject: string
    bodyText: string
    bodyHtml: string
  }
): Promise<{ messageId: string }> {
  // Get thread's message chain for References header
  const { data: threadMessages } = await supabase
    .from("email_messages")
    .select("message_id")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })

  const allMessageIds = (threadMessages || []).map((m) => m.message_id)
  const lastMessageId = allMessageIds[allMessageIds.length - 1] || undefined
  const referencesStr = allMessageIds.length > 0 ? allMessageIds.join(" ") : undefined

  // Send via SMTP
  const { messageId } = await sendEmail({
    ...opts,
    inReplyTo: lastMessageId,
    references: referencesStr,
  })

  // Store in DB
  const now = new Date().toISOString()
  await supabase.from("email_messages").insert({
    thread_id: threadId,
    message_id: messageId,
    in_reply_to: lastMessageId || null,
    references: referencesStr || null,
    from_email: AGENT_EMAIL,
    from_name: AGENT_NAME,
    to_email: opts.to.toLowerCase(),
    subject: opts.subject,
    body_text: opts.bodyText,
    body_html: opts.bodyHtml,
    from_agent: true,
    created_at: now,
    uid_imap: null,
    attachments: [],
  })

  // Update thread
  const { count } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)

  await supabase
    .from("email_threads")
    .update({
      last_message_at: now,
      message_count: count || 1,
      updated_at: now,
    })
    .eq("id", threadId)

  return { messageId }
}

// ─── Create new thread + send ───

export async function createAndSendThread(
  supabase: SupabaseClient,
  opts: {
    to: string
    toName?: string
    subject: string
    bodyText: string
    bodyHtml: string
  }
): Promise<{ threadId: string; messageId: string }> {
  // Send via SMTP first
  const { messageId } = await sendEmail(opts)

  const now = new Date().toISOString()

  // Create thread
  const { data: thread, error: threadErr } = await supabase
    .from("email_threads")
    .insert({
      thread_id: messageId,
      subject: opts.subject,
      status: "open",
      customer_name: opts.toName || opts.to,
      customer_email: opts.to.toLowerCase(),
      last_message_at: now,
      message_count: 1,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (threadErr || !thread) {
    throw new Error("Failed to create thread")
  }

  // Store message
  await supabase.from("email_messages").insert({
    thread_id: thread.id,
    message_id: messageId,
    in_reply_to: null,
    references: null,
    from_email: AGENT_EMAIL,
    from_name: AGENT_NAME,
    to_email: opts.to.toLowerCase(),
    subject: opts.subject,
    body_text: opts.bodyText,
    body_html: opts.bodyHtml,
    from_agent: true,
    created_at: now,
    uid_imap: null,
    attachments: [],
  })

  return { threadId: thread.id, messageId }
}
