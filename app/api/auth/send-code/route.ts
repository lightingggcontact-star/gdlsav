import { NextResponse } from "next/server"
import crypto from "crypto"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const SECRET = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

function signPayload(email: string, code: string, expiresAt: number): string {
  const payload = `${email}:${code}:${expiresAt}`
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex")
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 })
    }

    const code = generateCode()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
    const token = signPayload(email.toLowerCase(), code, expiresAt)

    await resend.emails.send({
      from: "GDL SAV <onboarding@resend.dev>",
      to: email,
      subject: `${code} — Code de vérification GDL SAV`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
          <h2 style="margin: 0 0 8px; font-size: 20px;">Code de vérification</h2>
          <p style="color: #666; margin: 0 0 24px; font-size: 14px;">
            Utilisez ce code pour créer votre compte GDL SAV.
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #18181b;">${code}</span>
          </div>
          <p style="color: #999; font-size: 12px; margin: 0;">
            Ce code expire dans 5 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ token, expiresAt })
  } catch (err) {
    console.error("Send code error:", err)
    return NextResponse.json({ error: "Impossible d'envoyer le code" }, { status: 500 })
  }
}
