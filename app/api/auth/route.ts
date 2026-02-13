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
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: code,
    })

    if (signUpError) {
      return NextResponse.json({ error: "Erreur de création de compte" }, { status: 500 })
    }

    // Sign in after signup
    const { error: finalError } = await supabase.auth.signInWithPassword({
      email,
      password: code,
    })

    if (finalError) {
      return NextResponse.json({ error: "Code incorrect" }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
