import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

interface GenerateEmailRequest {
  customerName: string | null
  customerEmail: string | null
  rating: number
  feedback: string | null
  formName: string
  submissionDate: string
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY manquante. Ajoutez-la dans .env.local" },
      { status: 500 }
    )
  }

  try {
    const body: GenerateEmailRequest = await request.json()
    const { customerName, rating, feedback, formName, submissionDate } = body

    const client = new Anthropic({ apiKey: key })

    const dateStr = new Date(submissionDate).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })

    const prompt = `Tu es le service après-vente de "Graine de Lascars", un e-commerce français de CBD premium.
Tu dois rédiger un email de suivi professionnel et empathique pour un client qui a laissé un avis insatisfaisant.

CONTEXTE :
- Nom du client : ${customerName || "Client"}
- Note donnée : ${rating}/5
- Formulaire : ${formName}
- Date de l'avis : ${dateStr}
- Commentaire du client : ${feedback ? `"${feedback}"` : "Aucun commentaire laissé"}

INSTRUCTIONS :
- Écris en français, tutoie le client (on est une marque jeune/cool)
- Sois sincèrement désolé et empathique, pas corporate
- Mentionne spécifiquement leur retour s'il y a un commentaire
- Propose une solution concrète (remplacement, remboursement, code promo, échange)
- Signe "L'équipe Graine de Lascars"
- Garde un ton humain et authentique, pas trop formel
- L'email doit faire 5-8 lignes max, court et efficace
- Ne mets PAS d'objet, juste le corps de l'email
- Commence directement par "Salut [prénom]" ou "Hey [prénom]"

Écris UNIQUEMENT le corps de l'email, rien d'autre.`

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    })

    const emailContent =
      message.content[0].type === "text" ? message.content[0].text : ""

    return NextResponse.json({
      email: emailContent,
      subject: `Suite à ton avis sur Graine de Lascars`,
    })
  } catch (error) {
    console.error("AI generate-email error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
