import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 })
  }

  try {
    const supabase = await createClient()
    const client = new Anthropic({ apiKey: key })

    // 1. Read all cached tickets with messages
    const { data: tickets, error } = await supabase
      .from("ticket_cache")
      .select("*")
      .gt("message_count", 1) // Only tickets with actual conversation
      .order("created_at", { ascending: false })
      .limit(100)

    if (error || !tickets || tickets.length === 0) {
      return NextResponse.json({ error: "Pas assez de tickets pour apprendre" }, { status: 400 })
    }

    // 2. Build conversation data for Claude to analyze
    const conversations = tickets.map((t) => {
      return `---
Ticket #${t.ticket_id} | ${t.subject || "(sans objet)"} | ${t.status}
Client: ${t.customer_name}
Tags: ${(t.tags || []).join(", ") || "aucun"}
Question client: ${t.first_message || "(vide)"}
Dernière réponse: ${t.last_message || "(vide)"}
---`
    }).join("\n\n")

    // 3. Ask Claude to extract patterns
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Tu es l'IA SAV de "Graine de Lascars" (e-commerce CBD français).

Analyse ces ${tickets.length} conversations SAV et extrais les PATTERNS RÉCURRENTS.

CONVERSATIONS :
${conversations}

EXTRAIS UN JSON avec ce format exact (pas de markdown, juste le JSON) :
[
  {
    "category": "nom de la catégorie (ex: livraison, produit_endommagé, remboursement, suivi_colis, code_promo, question_produit, retour)",
    "pattern": "description courte du pattern question client (ex: 'Client demande où est son colis, tracking bloqué')",
    "frequency": nombre estimé de fois que ce pattern apparaît,
    "typical_response": "le type de réponse que l'agent donne habituellement pour ce cas (résumé en 2-3 phrases du ton et contenu)",
    "key_info_needed": "les infos dont l'agent a besoin pour répondre (ex: numéro de suivi, date d'expédition)",
    "tone": "le ton utilisé (ex: empathique, direct, rassurant)"
  }
]

Extrais entre 5 et 15 patterns. Sois précis et concret. Seul le JSON, rien d'autre.`,
        },
      ],
    })

    const rawText = message.content[0].type === "text" ? message.content[0].text : "[]"

    // 4. Parse the JSON
    let patterns: Array<{
      category: string
      pattern: string
      frequency: number
      typical_response: string
      key_info_needed: string
      tone: string
    }> = []

    try {
      // Extract JSON from response (might have markdown code fences)
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        patterns = JSON.parse(jsonMatch[0])
      }
    } catch {
      console.error("Failed to parse AI patterns:", rawText.slice(0, 200))
      return NextResponse.json({ error: "Erreur de parsing des patterns" }, { status: 500 })
    }

    if (patterns.length === 0) {
      return NextResponse.json({ error: "Aucun pattern détecté" }, { status: 400 })
    }

    // 5. Store in Supabase (replace all)
    await supabase.from("ai_knowledge").delete().gte("learned_at", "1900-01-01") // Clear old patterns

    const rows = patterns.map((p) => ({
      category: p.category,
      pattern: p.pattern,
      frequency: p.frequency,
      typical_response: p.typical_response,
      key_info_needed: p.key_info_needed,
      tone: p.tone,
      learned_at: new Date().toISOString(),
      source_tickets: tickets.length,
    }))

    const { error: insertError } = await supabase.from("ai_knowledge").insert(rows)

    if (insertError) {
      console.error("Insert knowledge error:", insertError)
      return NextResponse.json({ error: "Erreur de sauvegarde" }, { status: 500 })
    }

    return NextResponse.json({
      patterns: patterns.length,
      tickets_analyzed: tickets.length,
      categories: [...new Set(patterns.map(p => p.category))],
    })
  } catch (error) {
    console.error("AI learn error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
