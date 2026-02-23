"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import Pochon from "./pochon"

interface GameStepProps {
  onReveal: (reward: { key: string; label: string; type: string }) => void
  email: string
  customerName: string
}

export default function GameStep({ onReveal, email, customerName }: GameStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelect = useCallback(async (index: number) => {
    if (selectedIndex !== null || loading) return

    setSelectedIndex(index)
    setLoading(true)

    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#4CAF50", "#66BB6A", "#FFD700", "#388E3C"],
      })
    }, 800)

    try {
      const res = await fetch("/api/game/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, customerName }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Erreur")

      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#4CAF50", "#66BB6A", "#FFD700", "#388E3C", "#ffffff"],
        })
        onReveal(data.reward)
      }, 2500)
    } catch (err) {
      console.error("Play error:", err)
      setTimeout(() => {
        onReveal({ key: "error", label: "Erreur — réessaie plus tard", type: "manual" })
      }, 1500)
    }
  }, [selectedIndex, loading, email, customerName, onReveal])

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="game-neon-glow text-3xl font-bold text-[#4CAF50] sm:text-4xl"
        style={{ fontFamily: "Bangers, cursive" }}
      >
        {selectedIndex === null ? "Choisis ton pochon !" : "Ouverture en cours..."}
      </motion.h2>

      {selectedIndex === null && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-400"
        >
          Un seul contient ta récompense... ou pas 😏
        </motion.p>
      )}

      {selectedIndex !== null && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="game-smoke"
              style={{
                left: `${40 + Math.random() * 20}%`,
                top: `${50 + Math.random() * 10}%`,
                animationDelay: `${i * 0.25}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 sm:gap-6">
        {[0, 1, 2].map((i) => (
          <Pochon
            key={i}
            index={i}
            selected={selectedIndex === i}
            eliminated={selectedIndex !== null && selectedIndex !== i}
            onClick={() => handleSelect(i)}
            disabled={selectedIndex !== null}
          />
        ))}
      </div>
    </motion.div>
  )
}
