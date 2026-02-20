// app/api/gbp/callback/route.ts
// Route TEMPORAIRE pour l'obtention du refresh token OAuth 2.0
// → SUPPRIMER CE FICHIER après avoir obtenu et collé le refresh token dans .env.local

import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis dans .env.local" },
      { status: 500 }
    )
  }

  // Si pas de code, afficher le lien d'autorisation
  if (!code) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "https://gdlsavaaa.vercel.app/api/gbp/callback"
    )

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/business.manage"],
    })

    return NextResponse.json({
      message: "Ouvre ce lien dans ton navigateur pour autoriser l'accès GBP :",
      authUrl,
    })
  }

  // Échanger le code contre les tokens
  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "https://gdlsavaaa.vercel.app/api/gbp/callback"
    )

    const { tokens } = await oauth2Client.getToken(code)

    console.log("=== GOOGLE REFRESH TOKEN ===")
    console.log(tokens.refresh_token)
    console.log("============================")

    return NextResponse.json({
      message:
        "Refresh token obtenu ! Copie-le dans .env.local comme GOOGLE_REFRESH_TOKEN, puis supprime ce fichier callback.",
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    })
  } catch (error) {
    console.error("Erreur OAuth callback:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors de l'échange OAuth",
      },
      { status: 500 }
    )
  }
}
