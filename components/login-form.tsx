"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"

type Mode = "login" | "signup" | "verify"

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState("")
  const [expiresAt, setExpiresAt] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const router = useRouter()
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // Focus code input when switching to verify mode
  useEffect(() => {
    if (mode === "verify") {
      setTimeout(() => codeInputRef.current?.focus(), 100)
    }
  }, [mode])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.push("/")
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || "Identifiants incorrects")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setToken(data.token)
        setExpiresAt(data.expiresAt)
        setMode("verify")
        setCountdown(60)
      } else {
        setError(data.error || "Impossible d'envoyer le code")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyAndSignup(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code, token, expiresAt }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push("/")
        router.refresh()
      } else {
        setError(data.error || "Erreur de vérification")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (countdown > 0) return
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setToken(data.token)
        setExpiresAt(data.expiresAt)
        setCountdown(60)
        setCode("")
      } else {
        setError(data.error || "Impossible de renvoyer le code")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  function switchMode(newMode: "login" | "signup") {
    setMode(newMode)
    setError("")
    setCode("")
    setToken("")
  }

  // Verify mode: OTP input
  if (mode === "verify") {
    return (
      <div className="w-full space-y-3">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Retour
        </button>

        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Vérification email</p>
          <p className="text-xs text-muted-foreground">
            Code envoyé à <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyAndSignup} className="space-y-3">
          <Input
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            placeholder="Code à 6 chiffres"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6)
              setCode(v)
            }}
            className="h-10 bg-background border-border text-center text-lg tracking-[0.3em] font-mono"
            maxLength={6}
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full h-10 font-medium bg-gdl-purple text-white hover:bg-gdl-purple/90"
          >
            {loading ? "Vérification..." : "Créer mon compte"}
          </Button>
        </form>

        <button
          type="button"
          onClick={handleResendCode}
          disabled={countdown > 0 || loading}
          className="w-full text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {countdown > 0 ? `Renvoyer le code (${countdown}s)` : "Renvoyer le code"}
        </button>
      </div>
    )
  }

  // Login or Signup form
  return (
    <form onSubmit={mode === "login" ? handleLogin : handleSendCode} className="w-full space-y-3">
      <div className="space-y-2">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          className="h-10 bg-background border-border"
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 bg-background border-border"
        />
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full h-10 font-medium bg-gdl-purple text-white hover:bg-gdl-purple/90"
      >
        {loading
          ? mode === "login" ? "Connexion..." : "Envoi du code..."
          : mode === "login" ? "Se connecter" : "Envoyer le code de vérification"
        }
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            Pas encore de compte ?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="text-gdl-purple hover:underline font-medium"
            >
              Créer un compte
            </button>
          </>
        ) : (
          <>
            Déjà un compte ?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-gdl-purple hover:underline font-medium"
            >
              Se connecter
            </button>
          </>
        )}
      </p>
    </form>
  )
}
