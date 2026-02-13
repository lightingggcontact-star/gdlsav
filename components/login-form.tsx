"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      if (res.ok) {
        router.push("/")
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || "Code incorrect")
      }
    } catch {
      setError("Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="space-y-2">
        <Input
          type="password"
          placeholder="Code d'accès"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          className="h-10 bg-background border-border"
        />
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={loading || !code}
        className="w-full h-10 font-medium bg-gdl-purple text-white hover:bg-gdl-purple/90"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </Button>
    </form>
  )
}
