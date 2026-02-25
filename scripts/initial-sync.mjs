// Full clean sync: INBOX + last 1000 Sent
// Run with: node --env-file=.env.local scripts/initial-sync.mjs
//   --purge   = delete all data first and start fresh
//   --sent    = also sync Sent folder (last 1000)

import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { createClient } from "@supabase/supabase-js"

const AGENT_EMAIL = "bonjour@grainedelascars.com"
const BATCH_SIZE = 50
const USER_ID = "f9e7c256-2e9d-4fb6-8453-dab114da9bdd"
const SENT_LIMIT = 1000

const args = process.argv.slice(2)
const doPurge = args.includes("--purge")
const doSent = args.includes("--sent")

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
    auth: { user: process.env.ZOHO_IMAP_USER, pass: process.env.ZOHO_IMAP_PASS },
    logger: false,
    socketTimeout: 60000,
  })
  client.on("error", () => {})
  return client
}

// Threading: In-Reply-To → References → Subject+CustomerEmail (7 days)
async function resolveThreadId(messageId, inReplyTo, references, subject, customerEmail) {
  if (inReplyTo) {
    const { data } = await supabase
      .from("email_messages").select("thread_id").eq("message_id", inReplyTo).limit(1).single()
    if (data) return { threadUuid: data.thread_id, isNew: false }
  }
  if (references) {
    const refs = references.split(/\s+/).filter(Boolean).reverse()
    for (const ref of refs.slice(0, 5)) {
      const { data } = await supabase
        .from("email_messages").select("thread_id").eq("message_id", ref).limit(1).single()
      if (data) return { threadUuid: data.thread_id, isNew: false }
    }
  }
  const stripped = stripSubjectPrefixes(subject)
  if (stripped && customerEmail) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("email_threads").select("id")
      .eq("subject", stripped).eq("customer_email", customerEmail.toLowerCase())
      .gte("last_message_at", sevenDaysAgo)
      .order("last_message_at", { ascending: false }).limit(1).single()
    if (data) return { threadUuid: data.id, isNew: false }
  }
  return { threadUuid: null, isNew: true }
}

function parseEmail(parsed, uid) {
  const messageId = parsed.messageId || `generated-${uid}@zoho`
  const inReplyTo = parsed.inReplyTo || null
  const references = parsed.references
    ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : parsed.references) : null
  const fromAddr = parsed.from?.value?.[0]?.address || ""
  const fromName = parsed.from?.value?.[0]?.name || ""
  const toAddr = parsed.to
    ? (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.address || "" : parsed.to.value?.[0]?.address || "") : ""
  const toName = parsed.to
    ? (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.name || "" : parsed.to.value?.[0]?.name || "") : ""
  const subject = parsed.subject || "(sans objet)"
  const date = parsed.date || new Date()
  const fromAgent = fromAddr.toLowerCase() === AGENT_EMAIL.toLowerCase()
  const customerEmail = fromAgent ? toAddr : fromAddr
  const customerName = fromAgent ? (toName || toAddr) : (fromName || fromAddr)

  return {
    messageId, inReplyTo, references, fromAddr, fromName, toAddr,
    subject, bodyText: parsed.text || null, bodyHtml: parsed.html || null,
    date, fromAgent, customerEmail, customerName, attachments: parsed.attachments || [],
  }
}

async function processEmail(email, uid, isFromSent) {
  // Duplicate check
  const { data: existing } = await supabase
    .from("email_messages").select("id").eq("message_id", email.messageId).limit(1).single()
  if (existing) return "skip"

  // Resolve thread
  const { threadUuid, isNew } = await resolveThreadId(
    email.messageId, email.inReplyTo, email.references, email.subject, email.customerEmail
  )
  let finalThreadUuid

  if (isNew || !threadUuid) {
    if (isFromSent && !threadUuid) {
      // Sent email with no matching thread — skip (orphan reply)
      return "skip"
    }
    const strippedSubject = stripSubjectPrefixes(email.subject)
    const { data: newThread, error: threadErr } = await supabase
      .from("email_threads").insert({
        thread_id: email.messageId, subject: strippedSubject || email.subject, status: "open",
        customer_name: email.customerName, customer_email: email.customerEmail.toLowerCase(),
        last_message_at: email.date.toISOString(), message_count: 1,
        created_at: email.date.toISOString(), updated_at: email.date.toISOString(),
      }).select("id").single()
    if (threadErr || !newThread) return "error"
    finalThreadUuid = newThread.id
  } else {
    finalThreadUuid = threadUuid
  }

  // Attachments
  const attachmentMeta = []
  if (email.attachments?.length) {
    for (const att of email.attachments) {
      try {
        const safeName = (att.filename || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${finalThreadUuid}/${uid}/${safeName}`
        const { error: uploadErr } = await supabase.storage.from("email-attachments")
          .upload(path, att.content, { contentType: att.contentType || "application/octet-stream", upsert: true })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("email-attachments").getPublicUrl(path)
          attachmentMeta.push({
            name: att.filename || "attachment", content_type: att.contentType || "application/octet-stream",
            size: att.size || 0, url: urlData.publicUrl,
          })
        }
      } catch { /* skip */ }
    }
  }

  // Insert message
  const { error: msgErr } = await supabase.from("email_messages").insert({
    thread_id: finalThreadUuid, message_id: email.messageId, in_reply_to: email.inReplyTo, references: email.references,
    from_email: email.fromAddr.toLowerCase(), from_name: email.fromName || null, to_email: email.toAddr.toLowerCase(),
    subject: email.subject, body_text: email.bodyText, body_html: email.bodyHtml ? String(email.bodyHtml) : null,
    from_agent: email.fromAgent, created_at: email.date.toISOString(), uid_imap: isFromSent ? null : uid,
    attachments: attachmentMeta,
  })
  if (msgErr) return "error"

  // Update thread stats
  if (!isNew && threadUuid) {
    const { count } = await supabase
      .from("email_messages").select("id", { count: "exact", head: true }).eq("thread_id", finalThreadUuid)
    await supabase.from("email_threads").update({
      last_message_at: email.date.toISOString(), message_count: count || 1, updated_at: new Date().toISOString(),
      ...(!email.fromAgent ? { status: "open" } : {}),
    }).eq("id", finalThreadUuid)
  }

  return "ok"
}

async function getUids(folder) {
  const client = makeImapClient()
  await client.connect()
  const lock = await client.getMailboxLock(folder)
  const uids = []
  const messages = client.fetch("1:*", { uid: true })
  for await (const m of messages) { uids.push(m.uid) }
  lock.release()
  await client.logout()
  return uids.sort((a, b) => a - b)
}

async function processBatch(folder, batchUids, isFromSent) {
  const client = makeImapClient()
  await client.connect()
  const lock = await client.getMailboxLock(folder)
  let synced = 0, errors = 0

  try {
    const uidRange = `${batchUids[0]}:${batchUids[batchUids.length - 1]}`
    const messages = client.fetch(uidRange, { uid: true, source: true })
    for await (const msg of messages) {
      if (!batchUids.includes(msg.uid)) continue
      try {
        const parsed = await simpleParser(msg.source)
        const email = parseEmail(parsed, msg.uid)
        const result = await processEmail(email, msg.uid, isFromSent)
        if (result === "ok") synced++
        else if (result === "error") errors++
      } catch { errors++ }
    }
  } finally {
    lock.release()
    await client.logout()
  }
  return { synced, errors }
}

async function syncFolder(folder, uids, isFromSent) {
  let totalSynced = 0, totalErrors = 0
  const totalBatches = Math.ceil(uids.length / BATCH_SIZE)

  for (let i = 0; i < uids.length; i += BATCH_SIZE) {
    const batchUids = uids.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    process.stdout.write(`  Batch ${batchNum}/${totalBatches}... `)

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await processBatch(folder, batchUids, isFromSent)
        totalSynced += result.synced
        totalErrors += result.errors
        console.log(`${result.synced} importés  |  Total: ${totalSynced}`)
        break
      } catch (err) {
        if (attempt < 3) {
          process.stdout.write(`retry ${attempt + 1}/3... `)
          await sleep(3000)
        } else {
          console.log(`ÉCHEC: ${err.message}`)
          totalErrors += batchUids.length
        }
      }
    }
    if (i + BATCH_SIZE < uids.length) await sleep(1500)
  }
  return { synced: totalSynced, errors: totalErrors }
}

async function main() {
  console.log("=== Sync complet Zoho → Supabase ===\n")

  // PURGE if requested
  if (doPurge) {
    console.log("PURGE: suppression de toutes les données...")
    // Delete in order (messages first because of FK)
    await supabase.from("email_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await supabase.from("email_threads").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await supabase.from("email_sync_state").update({ last_uid: 0, last_sync_at: new Date().toISOString() }).eq("id", "main")
    console.log("   Tables vidées\n")
  }

  // 1. INBOX sync
  console.log("1. INBOX — récupération des UIDs...")
  const inboxUids = await getUids("INBOX")

  // Check cursor
  const { data: syncState } = await supabase
    .from("email_sync_state").select("last_uid").eq("id", "main").single()
  const lastUid = syncState?.last_uid ?? 0
  const toSync = inboxUids.filter(uid => uid > lastUid)
  console.log(`   ${inboxUids.length} total, ${toSync.length} à importer (cursor: ${lastUid})\n`)

  if (toSync.length > 0) {
    const inboxResult = await syncFolder("INBOX", toSync, false)

    // Update cursor
    const maxUid = toSync[toSync.length - 1]
    await supabase.from("email_sync_state")
      .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() }).eq("id", "main")

    console.log(`\n   INBOX: ${inboxResult.synced} importés, ${inboxResult.errors} erreurs\n`)
  }

  // 2. SENT sync (last 1000 only)
  if (doSent) {
    console.log("2. SENT — récupération des UIDs...")
    const sentUids = await getUids("Sent")
    const recentSent = sentUids.slice(-SENT_LIMIT)
    console.log(`   ${sentUids.length} total, ${recentSent.length} à syncer (derniers ${SENT_LIMIT})\n`)

    if (recentSent.length > 0) {
      const sentResult = await syncFolder("Sent", recentSent, true)
      console.log(`\n   SENT: ${sentResult.synced} importés, ${sentResult.errors} erreurs\n`)
    }
  }

  // 3. Auto-mark replied status
  console.log("3. Statut répondu automatique...")
  // For each thread: if last message is from agent → mark as replied
  // This SQL needs to be run in Supabase SQL Editor due to RLS
  console.log("   Exécute dans Supabase SQL Editor :\n")
  console.log(`-- Marquer comme répondu les threads où le dernier message est de l'agent`)
  console.log(`DELETE FROM ticket_replied_status WHERE user_id = '${USER_ID}';`)
  console.log(`INSERT INTO ticket_replied_status (user_id, ticket_id, replied_at)`)
  console.log(`SELECT '${USER_ID}', t.id, last_agent.created_at`)
  console.log(`FROM email_threads t`)
  console.log(`JOIN LATERAL (`)
  console.log(`  SELECT em.created_at, em.from_agent`)
  console.log(`  FROM email_messages em`)
  console.log(`  WHERE em.thread_id = t.id`)
  console.log(`  ORDER BY em.created_at DESC LIMIT 1`)
  console.log(`) last_msg ON last_msg.from_agent = true`)
  console.log(`JOIN LATERAL (`)
  console.log(`  SELECT em.created_at`)
  console.log(`  FROM email_messages em`)
  console.log(`  WHERE em.thread_id = t.id AND em.from_agent = true`)
  console.log(`  ORDER BY em.created_at DESC LIMIT 1`)
  console.log(`) last_agent ON true;`)

  // 4. Close old threads
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  console.log(`\n-- Fermer les threads avant hier`)
  console.log(`UPDATE email_threads SET status = 'closed' WHERE last_message_at < '${yesterday.toISOString()}' AND status = 'open';`)

  // 5. Mark closed as read
  console.log(`\n-- Marquer les fermés comme lus`)
  console.log(`INSERT INTO ticket_read_status (user_id, ticket_id, read_at)`)
  console.log(`SELECT '${USER_ID}', id, now() FROM email_threads WHERE status = 'closed'`)
  console.log(`ON CONFLICT (user_id, ticket_id) DO NOTHING;`)

  console.log("\n=== Sync terminé ===")
}

main().catch(console.error)
