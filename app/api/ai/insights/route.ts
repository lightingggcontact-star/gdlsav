import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface TicketForInsights {
  ticket_id: number
  subject: string | null
  status: string
  customer_name: string
  created_at: string
  tags: string[]
  first_message: string
  last_message: string
  message_count: number
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 })
  }

  try {
    const {
      tickets,
      periodKey,
      periodLabel,
      periodFrom,
      periodTo,
    }: {
      tickets: TicketForInsights[]
      periodKey: string
      periodLabel: string
      periodFrom: string
      periodTo: string
    } = await request.json()

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ error: "Aucun ticket a analyser" }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: key })

    // Build conversation data for Claude
    const conversations = tickets
      .map(
        (t) => `---
Ticket #${t.ticket_id} | ${t.subject || "(sans objet)"} | ${t.status}
Client: ${t.customer_name}
Tags: ${(t.tags || []).join(", ") || "aucun"}
Date: ${new Date(t.created_at).toLocaleDateString("fr-FR")}
Messages: ${t.message_count}
Question client: ${t.first_message || "(vide)"}
Derniere reponse: ${t.last_message || "(vide)"}
---`
      )
      .join("\n\n")

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Tu es l'IA SAV de "Graine de Lascars" (e-commerce CBD francais).

Analyse ces ${tickets.length} tickets SAV de la periode "${periodLabel}" et extrais 3 types d'insights.

CONVERSATIONS :
${conversations}

EXTRAIS UN JSON avec ce format exact (pas de markdown, juste le JSON) :
{
  "pain_points": [
    {
      "id": 1,
      "label": "nom court du probleme (ex: Colis bloque en transit)",
      "description": "explication en 1-2 phrases",
      "frequency": nombre estime d'occurrences dans ces tickets,
      "severity": "high" ou "medium" ou "low",
      "example_ticket_id": numero du ticket exemple ou null,
      "example_quote": "extrait du message client illustrant ce probleme (max 100 mots)",
      "suggested_action": "action recommandee pour l'equipe SAV"
    }
  ],
  "objections": [
    {
      "id": 1,
      "label": "nom de l'objection (ex: Delai de reponse trop long)",
      "description": "description de l'objection",
      "frequency": nombre estime,
      "context": "dans quel contexte cette objection apparait",
      "example_quote": "extrait du message client",
      "recommended_response": "comment repondre a cette objection"
    }
  ],
  "extreme_reviews": {
    "positive": [
      {
        "ticket_id": numero,
        "customer_name": "nom",
        "quote": "extrait du message positif (max 80 mots)",
        "sentiment_score": 8 a 10,
        "topic": "sujet (ex: qualite produit, service client)",
        "date": "YYYY-MM-DD"
      }
    ],
    "negative": [
      {
        "ticket_id": numero,
        "customer_name": "nom",
        "quote": "extrait du message negatif (max 80 mots)",
        "sentiment_score": 1 a 3,
        "topic": "sujet",
        "date": "YYYY-MM-DD"
      }
    ]
  }
}

REGLES :
- IGNORE les problemes de livraison/colis/suivi/tracking/retard — ils sont deja geres ailleurs. Concentre-toi sur les problemes PRODUIT, SERVICE, QUALITE, PRIX, COMMUNICATION, etc.
- Pain points : entre 3 et 8, tries par frequence decroissante
- Objections : entre 2 et 6, triees par frequence decroissante
- Avis extremes : max 5 positifs et 5 negatifs, bases sur les VRAIS messages
- Les citations doivent etre des VRAIS extraits de messages, pas inventes
- Si pas assez de donnees pour une section, retourne un array vide
- Seul le JSON, rien d'autre.`,
        },
      ],
    })

    const rawText = message.content[0].type === "text" ? message.content[0].text : "{}"

    // Parse JSON from response
    let parsed: {
      pain_points: any[]
      objections: any[]
      extreme_reviews: { positive: any[]; negative: any[] }
    }

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found")
      }
    } catch {
      console.error("Failed to parse AI insights:", rawText.slice(0, 300))
      return NextResponse.json({ error: "Erreur de parsing des insights" }, { status: 500 })
    }

    // Ensure structure
    if (!parsed.pain_points) parsed.pain_points = []
    if (!parsed.objections) parsed.objections = []
    if (!parsed.extreme_reviews) parsed.extreme_reviews = { positive: [], negative: [] }
    if (!parsed.extreme_reviews.positive) parsed.extreme_reviews.positive = []
    if (!parsed.extreme_reviews.negative) parsed.extreme_reviews.negative = []

    // Store in Supabase cache
    const supabase = await createClient()
    const { error: upsertError } = await supabase
      .from("insights_cache")
      .upsert(
        {
          period_key: periodKey,
          period_label: periodLabel,
          period_from: periodFrom,
          period_to: periodTo,
          tickets_analyzed: tickets.length,
          pain_points: parsed.pain_points,
          objections: parsed.objections,
          extreme_reviews: parsed.extreme_reviews,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "period_key" }
      )

    if (upsertError) {
      console.error("Insights cache upsert error:", upsertError.message)
    }

    return NextResponse.json({
      pain_points: parsed.pain_points,
      objections: parsed.objections,
      extreme_reviews: parsed.extreme_reviews,
      tickets_analyzed: tickets.length,
    })
  } catch (error) {
    console.error("AI insights error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
