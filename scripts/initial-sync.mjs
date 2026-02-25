// One-time script to import all emails from Zoho IMAP into Supabase
// Run with: node --env-file=.env.local scripts/initial-sync.mjs

import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { createClient } from "@supabase/supabase-js"

const AGENT_EMAIL = "bonjour@grainedelascars.com"
const BATCH_SIZE = 50

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function stripSubjectPrefixes(subject) {
  return subject.replace(/^(Re|Fwd|Fw|TR|AW):\s*/gi, "").trim()
}

function makeImapClient() {
  const client = new ImapFlow({
    host: process.env.ZOHO_IMAP_HOST,
    port: Number(process.env.ZOHO_IMAP_PORT || 993),
    secure: true,
    auth: {
      user: process.env.ZOHO_IMAP_USER,
      pass: process.env.ZOHO_IMAP_PASS,
    },
    logger: false,
    socketTimeout: 60000,
  })
  // Prevent unhandled error crashes
  client.on("error", () => {})
  return client
}

async function resolveThreadId(messageId, inReplyTo, references, subject) {
  if (inReplyTo) {
    const { data } = await supabase
      .from("email_messages").select("thread_id").eq("message_id", inReplyTo).limit(1).single()
    if (data) return { threadUuid: data.thread_id, isNew: false }
  }
  if (references) {
    const refs = references.split(/\s+/).filter(Boolean).reverse()
    for (const ref of refs.slice(0, 3)) {
      const { data } = await supabase
        .from("email_messages").select("thread_id").eq("message_id", ref).limit(1).single()
      if (data) return { threadUuid: data.thread_id, isNew: false }
    }
  }
  const stripped = stripSubjectPrefixes(subject)
  if (stripped) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("email_threads").select("id").eq("subject", stripped)
      .gte("last_message_at", thirtyDaysAgo).order("last_message_at", { ascending: false }).limit(1).single()
    if (data) return { threadUuid: data.id, isNew: false }
  }
  return { threadUuid: null, isNew: true }
}

async function processEmail(parsed, uid) {
  const messageId = parsed.messageId || `generated-${uid}@zoho`
  const inReplyTo = parsed.inReplyTo || null
  const references = parsed.references
    ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : parsed.references) : null
  const fromAddr = parsed.from?.value?.[0]?.address || ""
  const fromName = parsed.from?.value?.[0]?.name || ""
  const toAddr = parsed.to
    ? (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.address || "" : parsed.to.value?.[0]?.address || "") : ""
  const subject = parsed.subject || "(sans objet)"
  const bodyText = parsed.text || null
  const bodyHtml = parsed.html || null
  const date = parsed.date || new Date()
  const fromAgent = fromAddr.toLowerCase() === AGENT_EMAIL.toLowerCase()
  const customerEmail = fromAgent ? toAddr : fromAddr
  const customerName = fromAgent
    ? (parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.name || toAddr : parsed.to.value?.[0]?.name || toAddr) : toAddr)
    : (fromName || fromAddr)

  // Duplicate check
  const { data: existing } = await supabase
    .from("email_messages").select("id").eq("message_id", messageId).limit(1).single()
  if (existing) return "skip"

  // Resolve thread
  const { threadUuid, isNew } = await resolveThreadId(messageId, inReplyTo, references, subject)
  let finalThreadUuid

  if (isNew || !threadUuid) {
    const strippedSubject = stripSubjectPrefixes(subject)
    const { data: newThread, error: threadErr } = await supabase
      .from("email_threads").insert({
        thread_id: messageId, subject: strippedSubject || subject, status: "open",
        customer_name: customerName, customer_email: customerEmail.toLowerCase(),
        last_message_at: date.toISOString(), message_count: 1,
        created_at: date.toISOString(), updated_at: date.toISOString(),
      }).select("id").single()
    if (threadErr || !newThread) return "error"
    finalThreadUuid = newThread.id
  } else {
    finalThreadUuid = threadUuid
  }

  // Attachments
  const attachmentMeta = []
  if (parsed.attachments?.length) {
    for (const att of parsed.attachments) {
      try {
        const safeName = (att.filename || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${finalThreadUuid}/${uid}/${safeName}`
        const { error: uploadErr } = await supabase.storage.from("email-attachments")
          .upload(path, att.content, { contentType: att.contentType || "application/octet-stream", upsert: true })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("email-attachments").getPublicUrl(path)
          attachmentMeta.push({ name: att.filename || "attachment", content_type: att.contentType || "application/octet-stream", size: att.size || 0, url: urlData.publicUrl })
        }
      } catch { /* skip */ }
    }
  }

  // Insert message
  const { error: msgErr } = await supabase.from("email_messages").insert({
    thread_id: finalThreadUuid, message_id: messageId, in_reply_to: inReplyTo, references,
    from_email: fromAddr.toLowerCase(), from_name: fromName || null, to_email: toAddr.toLowerCase(),
    subject, body_text: bodyText, body_html: bodyHtml ? String(bodyHtml) : null,
    from_agent: fromAgent, created_at: date.toISOString(), uid_imap: uid, attachments: attachmentMeta,
  })
  if (msgErr) return "error"

  // Update thread stats
  if (!isNew && threadUuid) {
    const { count } = await supabase.from("email_messages").select("id", { count: "exact", head: true }).eq("thread_id", finalThreadUuid)
    await supabase.from("email_threads").update({
      last_message_at: date.toISOString(), message_count: count || 1, updated_at: new Date().toISOString(),
      ...(!fromAgent ? { status: "open" } : {}),
    }).eq("id", finalThreadUuid)
  }
  return "ok"
}

async function getAllUids() {
  const client = makeImapClient()
  await client.connect()
  const lock = await client.getMailboxLock("INBOX")
  const allUids = []
  const uidFetch = client.fetch("1:*", { uid: true })
  for await (const m of uidFetch) { allUids.push(m.uid) }
  lock.release()
  await client.logout()
  return allUids.sort((a, b) => a - b)
}

async function processBatch(batchUids) {
  const batchClient = makeImapClient()
  await batchClient.connect()
  const batchLock = await batchClient.getMailboxLock("INBOX")

  let synced = 0
  let errors = 0
  let skipped = 0

  const uidRange = `${batchUids[0]}:${batchUids[batchUids.length - 1]}`
  const messages = batchClient.fetch(uidRange, { uid: true, source: true })

  for await (const msg of messages) {
    if (!batchUids.includes(msg.uid)) continue
    try {
      const parsed = await simpleParser(msg.source)
      const result = await processEmail(parsed, msg.uid)
      if (result === "ok") synced++
      else if (result === "error") errors++
      else skipped++
    } catch { errors++ }
  }

  batchLock.release()
  await batchClient.logout()

  // Save cursor
  const maxBatchUid = batchUids[batchUids.length - 1]
  await supabase.from("email_sync_state")
    .update({ last_uid: maxBatchUid, last_sync_at: new Date().toISOString() })
    .eq("id", "main")

  return { synced, errors, skipped }
}

async function main() {
  console.log("Import de tous les emails Zoho → Supabase")
  console.log("=========================================\n")

  // Get all UIDs
  console.log("1. Récupération des UIDs...")
  const allUids = await getAllUids()
  console.log(`   ${allUids.length} emails dans la boîte\n`)

  // Get cursor
  const { data: syncState } = await supabase
    .from("email_sync_state").select("last_uid").eq("id", "main").single()
  const lastUid = syncState?.last_uid ?? 0
  const toSync = allUids.filter(uid => uid > lastUid)
  console.log(`2. Dernier UID synced: ${lastUid}`)
  console.log(`   ${toSync.length} emails à importer\n`)

  if (toSync.length === 0) { console.log("Rien à importer !"); return }

  let totalSynced = 0
  let totalErrors = 0
  const totalBatches = Math.ceil(toSync.length / BATCH_SIZE)

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const batchUids = toSync.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    process.stdout.write(`Batch ${batchNum}/${totalBatches} (UIDs ${batchUids[0]}-${batchUids[batchUids.length - 1]})... `)

    // Retry up to 3 times per batch
    let success = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await processBatch(batchUids)
        totalSynced += result.synced
        totalErrors += result.errors
        console.log(`${result.synced} importés, ${result.errors} err  |  Total: ${totalSynced}`)
        success = true
        break
      } catch (err) {
        if (attempt < 3) {
          process.stdout.write(`retry ${attempt + 1}/3... `)
          await sleep(3000)
        } else {
          console.log(`ÉCHEC après 3 tentatives: ${err.message}`)
          totalErrors += batchUids.length
        }
      }
    }

    // Pause between batches
    if (i + BATCH_SIZE < toSync.length) await sleep(1500)
  }

  console.log(`\n=== RÉSULTAT ===`)
  console.log(`${totalSynced} emails importés`)
  console.log(`${totalErrors} erreurs`)
}

main().catch(console.error)
