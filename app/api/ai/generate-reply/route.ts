import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface CustomerOrder {
  name: string
  createdAt: string
  totalPrice: string
  fulfillmentStatus: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shipmentStatus: string | null
  countryCode?: string
}

interface GenerateReplyRequest {
  customerName: string
  customerEmail: string
  ticketSubject: string | null
  conversationHistory: {
    from_agent: boolean
    senderName: string
    body: string
    date: string
  }[]
  customerOrders?: {
    totalOrders: number
    totalSpent?: string | null
    orders: CustomerOrder[]
  }
  joyPoints?: {
    found: boolean
    points: number
    totalEarned?: number
    tier?: string | null
  } | null
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
    const body: GenerateReplyRequest = await request.json()
    const { customerName, ticketSubject, conversationHistory, customerOrders, joyPoints } = body

    const client = new Anthropic({ apiKey: key })

    // Fetch learned patterns from knowledge base
    let knowledgeContext = ""
    try {
      const supabase = await createClient()
      const { data: patterns } = await supabase
        .from("ai_knowledge")
        .select("category, pattern, typical_response, key_info_needed, tone")
        .order("frequency", { ascending: false })
        .limit(15)

      if (patterns && patterns.length > 0) {
        const patternLines = patterns.map((p) =>
          `• [${p.category}] ${p.pattern} → Réponse type : ${p.typical_response} (Ton: ${p.tone}, Infos nécessaires: ${p.key_info_needed})`
        ).join("\n")
        knowledgeContext = `\nPATTERNS APPRIS (basés sur tes conversations passées — utilise-les pour être cohérent) :\n${patternLines}\n`
      }
    } catch { /* knowledge base not available yet, continue without */ }

    // Detect if agent (Baba) already replied in this conversation
    const agentAlreadyReplied = conversationHistory.some(m => m.from_agent)

    // Build conversation context with FULL date+time
    const convoText = conversationHistory
      .map((msg) => {
        const role = msg.from_agent ? "AGENT (Baba)" : "CLIENT"
        const dt = new Date(msg.date)
        const dateStr = dt.toLocaleString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        return `[${role} — ${dateStr}] ${msg.senderName}:\n${msg.body}`
      })
      .join("\n\n---\n\n")

    // Build order context if available
    let orderContext = ""
    if (customerOrders && customerOrders.orders.length > 0) {
      const orderLines = customerOrders.orders.slice(0, 5).map((o) => {
        const date = new Date(o.createdAt).toLocaleDateString("fr-FR")
        const tracking = o.trackingNumber
          ? `Tracking: ${o.trackingNumber}${o.trackingUrl ? ` (${o.trackingUrl})` : ""}`
          : "Pas de tracking"
        const status = o.fulfillmentStatus || "Inconnu"
        const shipment = o.shipmentStatus ? ` — Expédition: ${o.shipmentStatus}` : ""
        const country = o.countryCode ? ` — Pays: ${o.countryCode}` : ""
        return `  • ${o.name} — ${date} — ${o.totalPrice}€ — Statut: ${status}${shipment}${country} — ${tracking}`
      })
      const totalSpentStr = customerOrders.totalSpent
        ? ` — Total dépensé: ${parseFloat(customerOrders.totalSpent).toFixed(0)}€`
        : ""
      orderContext = `\nINFOS COMMANDES SHOPIFY (${customerOrders.totalOrders} commande${customerOrders.totalOrders > 1 ? "s" : ""} au total${totalSpentStr}) :\n${orderLines.join("\n")}\n`
    }

    // Build loyalty context
    let loyaltyContext = ""
    if (joyPoints?.found) {
      loyaltyContext = `\nFIDÉLITÉ JOY : ${joyPoints.points} points disponibles (10 pts = 1€)${joyPoints.totalEarned ? ` — Total gagné: ${joyPoints.totalEarned} pts` : ""}${joyPoints.tier ? ` — Niveau: ${joyPoints.tier}` : ""}\n`
    }

    const firstName = customerName.split(" ")[0]
    const now = new Date().toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    // Smart greeting instruction
    const greetingInstruction = agentAlreadyReplied
      ? `IMPORTANT : Tu as DÉJÀ répondu à ce client dans cette conversation (regarde l'historique). NE REDIS PAS "Salut ${firstName}," — enchaîne directement sur le sujet. Commence naturellement, comme si tu continues la discussion (ex: "Ah oui", "Ok", "Super", "Nickel", "Bon", "Ah merde", etc.). Signe toujours "Baba" ou "Baba 🫡".`
      : `Commence par "Salut ${firstName}," et signe "Baba" ou "Baba 🫡".`

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      system: `Tu es Baba, le fondateur de Graine de Lascars (GDL), une marque de CBD premium française basée à Aix-en-Provence. Tu gères le SAV personnellement. Tu n'es PAS un bot, tu n'es PAS un service client corporate. Tu es un mec passionné qui répond à ses clients comme il parlerait à ses potes.

CONTEXTE TEMPOREL :
- Nous sommes le ${now}
- Analyse ATTENTIVEMENT les dates et heures de chaque message pour comprendre le fil de la conversation
- Si tu as déjà parlé au client aujourd'hui, tu le SAIS et tu n'as pas besoin de resaluer

IDENTITÉ & TON :
- Tutoiement TOUJOURS, même si le client vouvoie
- Langage naturel street-cool, comme un pote, pas un robot
- Empathique et sincère : quand y'a un problème, on assume, on s'excuse vraiment
- Pas de surjeu : cool mais pas fake
- Max 1-2 emojis par message (surtout 🙏 et 🫡)
- Concis : droit au but, pas de blabla

VOCABULAIRE :
✅ "Salut [Prénom]", "T'inquiète pas", "On gère", "Désolé pour la galère", "Dis-moi", "C'est réglé", "À très vite", "Ça fait plaisir"
❌ JAMAIS "Bonjour Monsieur/Madame", "Nous vous informons", "Cordialement", "N'hésitez pas à nous contacter", "Cher client", "Le service client GDL"

STRUCTURE :
1. Accroche — "Salut [Prénom]," seulement si c'est le PREMIER message de Baba dans la conversation. Si tu as déjà répondu, enchaîne naturellement sans resaluer.
2. Réponse au problème / empathie si galère
3. Action concrète / solution — utilise les VRAIES infos commandes/tracking/fidélité si elles sont disponibles
4. Clôture courte, pas de formule bateau
5. "Baba" ou "Baba 🫡" — TOUJOURS signer ainsi

DONNÉES DISPONIBLES :
- Utilise les infos commandes Shopify (numéros, statuts, tracking) pour donner des réponses PRÉCISES
- Si tu as le lien de tracking, DONNE-LE au client
- Si le client a des points fidélité, mentionne-les si pertinent (10 pts = 1€, utilisables dans le panier)
- Adapte ta réponse au pays de livraison (délais FR vs BE vs international)
- Délais habituels : France 2-4j, Belgique 3-5j, autres UE 5-7j

RÈGLES PAR CATÉGORIE :
- RETARD LIVRAISON : blâmer le transporteur (Chrono/Colissimo/La Poste), jamais le client. Donner tracking si dispo. Si retard critique (FR 5+j, BE 7+j), proposer renvoi.
- RETOUR POSITIF : remercier sincèrement sans en faire des caisses. "Bienvenue dans la bande" pour les nouveaux. Si témoignage puissant → proposer de le partager.
- MODIFICATION COMMANDE : trouver une solution. Si déjà partie, être transparent.
- QUESTIONS PRODUITS : répondre avec expertise. Best-sellers : Blueberry Muffin, Amnésia Hydro, Green Poison, Bubble Hash (résine 40% CBD).
- CASHBACK/FIDÉLITÉ : 10 points = 1€, encart sur la page panier. Si pas réussi → proposer code promo équivalent.
- PROBLÈME QUALITÉ : ne jamais minimiser. Proposer renvoi/avoir/cadeau.
- CLIENT FRUSTRÉ : ne jamais se braquer. Reconnaître la frustration, assumer, solution concrète immédiate.

LONGUEUR :
- Question simple → 2-3 lignes
- Problème à résoudre → 4-6 lignes
- Client frustré → 5-8 lignes
- Retour positif → 2-4 lignes
- JAMAIS plus de 10 lignes

CE QUE TU NE DOIS JAMAIS FAIRE :
- Vouvoyer
- Utiliser un ton corporate/robot
- Promettre une date de livraison exacte (dire "d'ici 2-3 jours", pas "le 15 février à 14h")
- Mentir sur le tracking
- Donner des infos médicales / claims santé
- Mentionner le THC positivement
- Dire "Je suis une IA"
- Utiliser "N'hésitez pas" ou "Cordialement"
- Faire une réponse trop longue
- Resaluer un client à qui tu as DÉJÀ répondu dans la même conversation
${knowledgeContext}`,
      messages: [
        {
          role: "user",
          content: `TICKET CLIENT :
- Prénom : ${firstName}
- Nom complet : ${customerName}
- Sujet : ${ticketSubject || "Sans objet"}
${orderContext}${loyaltyContext}
HISTORIQUE COMPLET DE CONVERSATION (avec dates et heures) :

${convoText}

---

Rédige la réponse de Baba au DERNIER message du client. Écris UNIQUEMENT le corps du mail, rien d'autre (pas d'objet, pas de commentaire).
${greetingInstruction}`,
        },
      ],
    })

    const reply =
      message.content[0].type === "text" ? message.content[0].text : ""

    return NextResponse.json({ reply })
  } catch (error) {
    console.error("AI generate-reply error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur IA" },
      { status: 500 }
    )
  }
}
