import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// 3 admin codes → each maps to a distinct Supabase user
const ADMIN_CODES: Record<string, string> = {
  "GDLBOSS1": "admin1@gdlsav.app",
  "GDLBOSS2": "admin2@gdlsav.app",
  "GDLBOSS3": "admin3@gdlsav.app",
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Code requis" }, { status: 400 })
    }

    const email = ADMIN_CODES[code.toUpperCase()]
    if (!email) {
      return NextResponse.json({ error: "Code incorrect" }, { status: 401 })
    }

    const supabase = await createClient()

    // Try sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: code,
    })

    if (!signInError) {
      return NextResponse.json({ success: true })
    }

    // User doesn't exist yet — create it (first use of this code)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: code,
      options: { emailRedirectTo: undefined },
    })

    if (signUpError) {
      console.error("SignUp error:", signUpError.message)
      // If user already exists but unconfirmed, suggest fix
      if (signUpError.message.includes("already registered")) {
        return NextResponse.json({
          error: "Compte en attente de confirmation. Désactivez 'Confirm email' dans Supabase Auth Settings.",
        }, { status: 500 })
      }
      return NextResponse.json({ error: "Erreur serveur: " + signUpError.message }, { status: 500 })
    }

    // If signUp returned a session (email confirmation OFF), we're logged in
    if (signUpData.session) {
      return NextResponse.json({ success: true })
    }

    // signUp succeeded but no session = email confirmation is ON
    // Try to sign in anyway (might work if auto-confirm is on)
    const { error: finalError } = await supabase.auth.signInWithPassword({
      email,
      password: code,
    })

    if (finalError) {
      console.error("Post-signup signIn error:", finalError.message)
      return NextResponse.json({
        error: "Désactivez 'Confirm email' dans Supabase > Auth > Providers > Email",
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Auth error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
