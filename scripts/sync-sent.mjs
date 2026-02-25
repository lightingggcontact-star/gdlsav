// Sync Sent folder to recover agent replies
// Run with: node --env-file=.env.local scripts/sync-sent.mjs

import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { createClient } from "@supabase/supabase-js"

const AGENT_EMAIL = "bonjour@grainedelascars.com"
const BATCH_SIZE = 50
const USER_ID = "f9e7c256-2e9d-4fb6-8453-dab114da9bdd"

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
  client.on("error", () => {})
  return client
}

// Step 1: List mailboxes to find the Sent folder name
async function listFolders() {
  const client = makeImapClient()
  await client.connect()
  const mailboxes = await client.list()
  await client.logout()
  return mailboxes
}

// Step 2: Get all UIDs from a folder
async function getUids(folder) {
  const client = makeImapClient()
  await client.connect()
  const lock = await client.getMailboxLock(folder)
  const uids = []
  try {
    const messages = client.fetch("1:*", { uid: true })
    for await (const m of messages) { uids.push(m.uid) }
  } finally {
    lock.release()
    await client.logout()
  }
  return uids.sort((a, b) => a - b)
}

// Step 3: Process a batch of sent emails
async function processBatch(folder, batchUids) {
  const client = makeImapClient()
  await client.connect()
  const lock = await client.getMailboxLock(folder)

  let synced = 0
  let errors = 0
  let linked = 0

  try {
    const uidRange = `${batchUids[0]}:${batchUids[batchUids.length - 1]}`
    const messages = client.fetch(uidRange, { uid: true, source: true })

    for await (const msg of messages) {
      if (!batchUids.includes(msg.uid)) continue

      try {
        const parsed = await simpleParser(msg.source)
        const messageId = parsed.messageId || `sent-${msg.uid}@zoho`
        const inReplyTo = parsed.inReplyTo || null
        const references = parsed.references
          ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : parsed.references)
          : null

        const fromAddr = parsed.from?.value?.[0]?.address || ""
        const fromName = parsed.from?.value?.[0]?.name || ""
        const toAddr = parsed.to
          ? (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.address || "" : parsed.to.value?.[0]?.address || "")
          : ""
        const subject = parsed.subject || "(sans objet)"
        const bodyText = parsed.text || null
        const bodyHtml = parsed.html || null
        const date = parsed.date || new Date()

        // Check if already exists
        const { data: existing } = await supabase
          .from("email_messages").select("id").eq("message_id", messageId).limit(1).single()
        if (existing) continue

        // Find the thread this reply belongs to
        let threadId = null

        // Try In-Reply-To
        if (inReplyTo) {
          const { data } = await supabase
            .from("email_messages").select("thread_id").eq("message_id", inReplyTo).limit(1).single()
          if (data) threadId = data.thread_id
        }

        // Try References
        if (!threadId && references) {
          const refs = references.split(/\s+/).filter(Boolean).reverse()
          for (const ref of refs.slice(0, 3)) {
            const { data } = await supabase
              .from("email_messages").select("thread_id").eq("message_id", ref).limit(1).single()
            if (data) { threadId = data.thread_id; break }
          }
        }

        // Try subject match
        if (!threadId) {
          const stripped = stripSubjectPrefixes(subject)
          if (stripped) {
            const { data } = await supabase
              .from("email_threads").select("id").eq("subject", stripped)
              .order("last_message_at", { ascending: false }).limit(1).single()
            if (data) threadId = data.id
          }
        }

        if (!threadId) {
          // Can't find thread for this sent email — skip
          continue
        }

        // Insert the sent message
        const { error: msgErr } = await supabase.from("email_messages").insert({
          thread_id: threadId,
          message_id: messageId,
          in_reply_to: inReplyTo,
          references,
          from_email: fromAddr.toLowerCase(),
          from_name: fromName || null,
          to_email: toAddr.toLowerCase(),
          subject,
          body_text: bodyText,
          body_html: bodyHtml ? String(bodyHtml) : null,
          from_agent: true,
          created_at: date.toISOString(),
          uid_imap: null,
          attachments: [],
        })

        if (msgErr) { errors++; continue }

        synced++
        linked++

        // Update thread message count
        const { count } = await supabase
          .from("email_messages").select("id", { count: "exact", head: true }).eq("thread_id", threadId)
        await supabase.from("email_threads").update({
          message_count: count || 1,
          updated_at: new Date().toISOString(),
        }).eq("id", threadId)

      } catch { errors++ }
    }
  } finally {
    lock.release()
    await client.logout()
  }

  return { synced, errors, linked }
}

async function main() {
  // 1. Find Sent folder
  console.log("1. Recherche du dossier Sent...")
  const folders = await listFolders()

  // Find the sent folder
  let sentFolder = null
  for (const f of folders) {
    const name = f.path.toLowerCase()
    if (name === "sent" || name === "sent items" || name === "sent mail" ||
        name === "envoyés" || name === "elements envoyés" ||
        f.specialUse === "\\Sent") {
      sentFolder = f.path
      break
    }
  }

  if (!sentFolder) {
    console.log("Dossiers trouvés:")
    for (const f of folders) {
      console.log(`  ${f.path} ${f.specialUse || ""}`)
    }
    console.log("\nPas de dossier Sent trouvé automatiquement.")
    console.log("Relance avec: SENT_FOLDER=NomDuDossier node scripts/sync-sent.mjs")
    process.exit(1)
  }

  console.log(`   Dossier: ${sentFolder}\n`)

  // 2. Get UIDs
  console.log("2. Récupération des UIDs...")
  const uids = await getUids(sentFolder)
  console.log(`   ${uids.length} emails envoyés\n`)

  // 3. Process in batches
  let totalSynced = 0
  let totalErrors = 0
  const totalBatches = Math.ceil(uids.length / BATCH_SIZE)

  for (let i = 0; i < uids.length; i += BATCH_SIZE) {
    const batchUids = uids.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    process.stdout.write(`Batch ${batchNum}/${totalBatches}... `)

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await processBatch(sentFolder, batchUids)
        totalSynced += result.synced
        totalErrors += result.errors
        console.log(`${result.synced} liés à des threads  |  Total: ${totalSynced}`)
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

  console.log(`\n=== Sent sync ===`)
  console.log(`${totalSynced} réponses importées`)
  console.log(`${totalErrors} erreurs\n`)

  // 4. Now populate ticket_replied_status from agent messages
  console.log("4. Mise à jour du statut répondu...")

  // Get all threads that have agent messages
  const { data: agentThreads } = await supabase
    .from("email_messages")
    .select("thread_id, created_at")
    .eq("from_agent", true)
    .order("created_at", { ascending: false })

  if (agentThreads?.length) {
    // Keep most recent reply per thread
    const threadMap = new Map()
    for (const msg of agentThreads) {
      if (!threadMap.has(msg.thread_id)) {
        threadMap.set(msg.thread_id, msg.created_at)
      }
    }

    console.log(`   ${threadMap.size} threads avec réponse agent`)
    console.log("   (insertion via SQL directe nécessaire — RLS bloque la clé anon)")
    console.log(`\n   Exécute dans Supabase SQL Editor:\n`)
    console.log(`   -- Marquer les threads avec réponse agent comme "répondu"`)
    console.log(`   INSERT INTO ticket_replied_status (user_id, ticket_id, replied_at)`)
    console.log(`   SELECT '${USER_ID}', em.thread_id, MAX(em.created_at)`)
    console.log(`   FROM email_messages em`)
    console.log(`   WHERE em.from_agent = true`)
    console.log(`   GROUP BY em.thread_id`)
    console.log(`   ON CONFLICT (user_id, ticket_id) DO UPDATE SET replied_at = EXCLUDED.replied_at;`)
  }

  console.log("\nTerminé !")
}

main().catch(console.error)
