import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

interface ReviewInput {
  submissionId: string
  rating: number
  feedback: string | null
  customerName: string | null
  submissionDate: string
  formName: string
}

export interface ReviewAnalysis {
  submissionId: string
  urgency: number // 1-10
  category: string // "livraison" | "qualité" | "goût" | "emballage" | "prix" | "service" | "autre"
  suggestedAction: string // short action recommendation
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY manquante" },
      { status: 500 }
    )
  }

  try {
    const { reviews }: { reviews: ReviewInput[] } = await request.json()

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ analyses: [] })
    }

    const client = new Anthropic({ apiKey: key })

    // Build review summaries for Claude
    const reviewsSummary = reviews
      .map(
        (r, i) =>
          `[${i}] ID: ${r.submissionId} | Note: ${r.rating}/5 | Client: ${r.customerName || "Anonyme"} | Date: ${new Date(r.submissionDate).toLocaleDateString("fr-FR")} | Formulaire: ${r.formName} | Commentaire: ${r.feedback || "Aucun"}`
      )
      .join("\n")

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Tu es l'IA du SAV de "Graine de Lascars" (e-commerce CBD français).

Analyse ces avis clients insatisfaits et pour CHACUN, donne :
1. Un score d'URGENCE de 1 à 10 (10 = à traiter immédiatement)
2. Une CATÉGORIE parmi : livraison, qualité, goût, emballage, prix, service, autre
3. Une ACTION suggérée en 1 phrase courte

Critères d'urgence :
- Note 1/5 = +3 points de base, 2/5 = +2, 3/5 = +1
- Commentaire négatif/menaçant = +2-3
- Avis récent (< 7 jours) = +1
- Aucun commentaire = -1 (moins d'info pour agir)
- Client nommé = +1 (plus personnalisable)

AVIS À ANALYSER :
${reviewsSummary}

Réponds UNIQUEMENT en JSON valide, sous cette forme exacte :
[
  { "submissionId": "...", "urgency": 8, "category": "livraison", "suggestedAction": "Proposer un renvoi express + code promo" },
  ...
]

Pas de texte avant ou après le JSON.`,
        },
      ],
    })

    const text =
      message.content[0].type === "text" ? message.content[0].text : "[]"

    // Parse JSON from response
    let analyses: ReviewAnalysis[]
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      analyses = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    } catch {
      console.error("Failed to parse AI response:", text)
      analyses = []
    }

    return NextResponse.json({ analyses })
  } catch (error) {
    console.error("AI analyze-reviews error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
