import { NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"

const SECRET = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function signPayload(email: string, code: string, expiresAt: number): string {
  const payload = `${email}:${code}:${expiresAt}`
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex")
}

export async function POST(request: Request) {
  try {
    const { email, password, code, token, expiresAt } = await request.json()

    if (!email || !password || !code || !token || !expiresAt) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 })
    }

    // Check expiry
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "Code expiré, veuillez en demander un nouveau" }, { status: 400 })
    }

    // Verify HMAC
    const expected = signPayload(email.toLowerCase(), code, expiresAt)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(token, "hex")
    )

    if (!isValid) {
      return NextResponse.json({ error: "Code incorrect" }, { status: 400 })
    }

    // Create user via Supabase Auth
    const supabase = await createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    })

    if (error) {
      if (error.message.includes("already registered")) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Auto sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      return NextResponse.json({ error: "Compte créé mais connexion échouée. Essayez de vous connecter." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Signup error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
