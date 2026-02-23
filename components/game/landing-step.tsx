"use client"

import { useState } from "react"
import { motion } from "framer-motion"

interface LandingStepProps {
  onSubmit: (email: string) => void
  loading: boolean
  error: string | null
}

export default function LandingStep({ onSubmit, loading, error }: LandingStepProps) {
  const [email, setEmail] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim()) onSubmit(email.trim())
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      className="flex w-full max-w-sm flex-col items-center gap-8 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-5xl"
      >
        🌿
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="game-neon-glow text-4xl font-bold leading-tight tracking-tight text-[#4CAF50] sm:text-5xl"
        style={{ fontFamily: "Bangers, cursive" }}
      >
        Baba t&apos;a réservé
        <br />
        un petit cadeau
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="max-w-xs text-lg text-gray-400"
      >
        Entre ton email pour vérifier ton compte et tenter ta chance !
      </motion.p>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          required
          autoFocus
          className="w-full rounded-xl border border-[#4CAF50]/30 bg-black/50 px-5 py-4 text-center text-base text-white placeholder:text-gray-500 focus:border-[#4CAF50] focus:outline-none focus:ring-1 focus:ring-[#4CAF50]"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <motion.button
          type="submit"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={loading || !email.trim()}
          className="game-btn-pulse rounded-full bg-[#4CAF50] px-10 py-4 text-lg font-bold text-black transition-colors hover:bg-[#66BB6A] disabled:opacity-50 disabled:animate-none"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Vérification...
            </span>
          ) : (
            "C'est parti ! 🔥"
          )}
        </motion.button>
      </motion.form>
    </motion.div>
  )
}
