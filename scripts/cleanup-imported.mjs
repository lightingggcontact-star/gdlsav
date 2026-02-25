// Mark replied threads + close old ones after initial import
// Run with: node --env-file=.env.local scripts/cleanup-imported.mjs <user_id>

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.log("Usage: node scripts/cleanup-imported.mjs <user_id>")
    process.exit(1)
  }

  console.log(`User ID: ${userId}\n`)

  // 1. Close all threads before yesterday
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const cutoff = yesterday.toISOString()

  console.log(`1. Fermeture des threads avant ${cutoff.slice(0, 10)}...`)

  // Do in batches since there could be thousands
  let totalClosed = 0
  while (true) {
    const { data: batch, error } = await supabase
      .from("email_threads")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .lt("last_message_at", cutoff)
      .eq("status", "open")
      .select("id")
      .limit(500)

    if (error) {
      console.error("   Error:", error.message)
      break
    }
    totalClosed += batch?.length || 0
    if (!batch?.length) break
  }
  console.log(`   ${totalClosed} threads fermés\n`)

  // 2. Get ALL closed threads and mark as replied + read
  console.log("2. Récupération des threads fermés...")

  let allClosedIds = []
  let offset = 0
  while (true) {
    const { data: batch } = await supabase
      .from("email_threads")
      .select("id")
      .eq("status", "closed")
      .range(offset, offset + 999)

    if (!batch?.length) break
    allClosedIds.push(...batch.map(t => t.id))
    offset += batch.length
    if (batch.length < 1000) break
  }
  console.log(`   ${allClosedIds.length} threads fermés au total\n`)

  // 3. Mark all closed threads as replied
  console.log("3. Marquage comme répondu...")
  let repliedCount = 0
  for (let i = 0; i < allClosedIds.length; i += 100) {
    const batch = allClosedIds.slice(i, i + 100).map(id => ({
      user_id: userId,
      ticket_id: String(id),
      replied_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from("ticket_replied_status")
      .upsert(batch, { onConflict: "user_id,ticket_id" })

    if (error) {
      console.error(`   Batch ${i} err:`, error.message)
      // If column type mismatch, stop and show fix
      if (error.message.includes("integer") || error.message.includes("type")) {
        console.log("\n   ⚠ La colonne ticket_id est en INTEGER, il faut la passer en TEXT.")
        console.log("   Exécute ce SQL dans Supabase SQL Editor :\n")
        console.log("   ALTER TABLE ticket_replied_status ALTER COLUMN ticket_id TYPE TEXT;")
        console.log("   ALTER TABLE ticket_read_status ALTER COLUMN ticket_id TYPE TEXT;")
        console.log("   ALTER TABLE ticket_labels ALTER COLUMN ticket_id TYPE TEXT;\n")
        console.log("   Puis relance ce script.")
        process.exit(1)
      }
    } else {
      repliedCount += batch.length
      if (repliedCount % 500 === 0) process.stdout.write(`   ${repliedCount}... `)
    }
  }
  console.log(`\n   ${repliedCount} threads marqués comme répondus\n`)

  // 4. Mark all closed threads as read
  console.log("4. Marquage comme lu...")
  let readCount = 0
  for (let i = 0; i < allClosedIds.length; i += 100) {
    const batch = allClosedIds.slice(i, i + 100).map(id => ({
      user_id: userId,
      ticket_id: String(id),
      read_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from("ticket_read_status")
      .upsert(batch, { onConflict: "user_id,ticket_id" })

    if (error) {
      console.error(`   Batch err:`, error.message)
      if (error.message.includes("integer") || error.message.includes("type")) {
        console.log("   ⚠ Même problème — ALTER TABLE ticket_read_status ALTER COLUMN ticket_id TYPE TEXT;")
        break
      }
    } else {
      readCount += batch.length
      if (readCount % 500 === 0) process.stdout.write(`   ${readCount}... `)
    }
  }
  console.log(`\n   ${readCount} threads marqués comme lus\n`)

  // Count what's left open
  const { count } = await supabase
    .from("email_threads")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")

  console.log(`=== RÉSULTAT ===`)
  console.log(`${totalClosed} threads fermés`)
  console.log(`${repliedCount} marqués répondus`)
  console.log(`${readCount} marqués lus`)
  console.log(`${count || 0} threads encore ouverts (hier + aujourd'hui)`)
}

main().catch(console.error)
