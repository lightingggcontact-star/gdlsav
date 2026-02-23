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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-sm flex-col items-center gap-8 text-center"
    >
      {/* Sticker badge */}
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: -2 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
      >
        <span className="brutal-badge text-base">CADEAU</span>
      </motion.div>

      {/* Main heading */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-4xl font-bold uppercase leading-tight tracking-tight text-white sm:text-5xl"
      >
        BABA T&apos;A RÉSERVÉ
        <br />
        <span className="text-[#8B5CF6]">UN PETIT CADEAU</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="max-w-xs text-base text-[#888]"
      >
        Entre ton email pour vérifier ton compte et tenter ta chance.
      </motion.p>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-4"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          required
          autoFocus
          className="brutal-input w-full text-center"
        />

        {error && (
          <p className="border-l-2 border-[#FF3333] pl-3 text-left text-sm text-[#FF3333]">
            {error}
          </p>
        )}

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={loading || !email.trim()}
          className="brutal-btn w-full border-2 border-white bg-[#8B5CF6] px-10 py-4 text-lg text-black shadow-[4px_4px_0px_#000]"
        >
          {loading ? "VÉRIFICATION..." : "C'EST PARTI"}
        </motion.button>
      </motion.form>
    </motion.div>
  )
}
