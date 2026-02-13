import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

interface ReviewForSummary {
  rating: number
  feedback: string | null
  formName: string
  submissionDate: string
  category?: string
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
    const { reviews, totalReviews, avgRating }: {
      reviews: ReviewForSummary[]
      totalReviews: number
      avgRating: number | null
    } = await request.json()

    const client = new Anthropic({ apiKey: key })

    const criticalCount = reviews.filter((r) => r.rating <= 3).length
    const goodCount = reviews.filter((r) => r.rating >= 4).length

    const reviewDetails = reviews
      .map(
        (r) =>
          `- ${r.rating}/5 (${new Date(r.submissionDate).toLocaleDateString("fr-FR")}) [${r.formName}]${r.category ? ` [${r.category}]` : ""}: ${r.feedback || "Pas de commentaire"}`
      )
      .join("\n")

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Tu es l'IA SAV de "Graine de Lascars" (CBD e-commerce français).

Fais un RÉSUMÉ HEBDOMADAIRE concis et actionnable de l'activité SAV.

DONNÉES :
- Total avis toutes périodes : ${totalReviews}
- Note moyenne : ${avgRating?.toFixed(1) || "N/A"}/5
- Avis critiques (≤3) : ${criticalCount}
- Avis positifs (≥4) : ${goodCount}

DÉTAILS DES AVIS RÉCENTS :
${reviewDetails || "Aucun avis récent"}

FORMAT (en français, direct, pas de blabla) :
1. **Résumé** : 2-3 phrases sur l'état général
2. **Problèmes récurrents** : top 2-3 problèmes identifiés (avec nombre d'occurrences si possible)
3. **Actions prioritaires** : 2-3 actions concrètes à faire cette semaine
4. **Point positif** : un truc bien à noter

Sois direct et concret. Pas de formules de politesse.`,
        },
      ],
    })

    const summary =
      message.content[0].type === "text" ? message.content[0].text : ""

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("AI weekly-summary error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
