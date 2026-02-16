import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

interface TicketForRecap {
  id: number
  subject: string | null
  status: string
  priority: string | null
  customerName: string
  customerEmail: string
  createdAt: string
  tags: string[]
  firstMessage: string
  lastMessage: string
  messageCount: number
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 })
  }

  try {
    const { tickets }: { tickets: TicketForRecap[] } = await request.json()

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ error: "Aucun ticket à analyser" }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: key })

    const openCount = tickets.filter(t => t.status === "open").length
    const closedCount = tickets.filter(t => t.status === "closed").length

    const ticketDetails = tickets.map(t => {
      const tags = t.tags.length > 0 ? ` [Tags: ${t.tags.join(", ")}]` : ""
      return `### Ticket #${t.id} — ${t.subject || "(sans objet)"}${tags}
- Client: ${t.customerName} (${t.customerEmail})
- Statut: ${t.status} | Priorité: ${t.priority || "normal"} | ${t.messageCount} messages
- Créé le: ${t.createdAt}
- Premier message: ${t.firstMessage.slice(0, 400)}
- Dernier message: ${t.lastMessage.slice(0, 400)}`
    }).join("\n\n")

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Tu es l'IA SAV de "Graine de Lascars" (e-commerce CBD français).

Fais un RÉCAP COMPLET des tickets SAV de cette semaine. Je veux un document structuré que je peux partager avec mon équipe.

DONNÉES DE LA SEMAINE :
- ${tickets.length} tickets au total
- ${openCount} ouverts / ${closedCount} fermés

DÉTAIL DES TICKETS :
${ticketDetails}

GÉNÈRE LE RÉCAP EN MARKDOWN avec ce format :

# Récap SAV — Semaine du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}

## Vue d'ensemble
(2-3 phrases résumant la semaine : volume, tendances, ambiance générale)

## Répartition par catégorie
(Tableau ou liste. Catégorise CHAQUE ticket : Livraison, Produit endommagé, Remboursement, Question produit, Code promo, Retour, Autre... avec le nombre pour chaque catégorie)

## Problèmes principaux
(Top 3-5 problèmes avec détails : combien de clients touchés, quel est le souci exactement)

## Tickets urgents / à traiter en priorité
(Liste des tickets encore ouverts qui méritent attention, avec le numéro et pourquoi c'est prioritaire)

## Tendances et observations
(Patterns récurrents, comparaison si possible, points d'attention)

## Actions recommandées
(3-5 actions concrètes pour la semaine prochaine)

---
*Récap généré par IA — ${tickets.length} tickets analysés*

Sois direct, concret, en français. Pas de blabla. Utilise des chiffres.`,
        },
      ],
    })

    const recap = message.content[0].type === "text" ? message.content[0].text : ""

    return NextResponse.json({ recap })
  } catch (error) {
    console.error("AI ticket-recap error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
