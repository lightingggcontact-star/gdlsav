"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import GameCard from "./card"

interface GameStepProps {
  onReveal: (reward: { key: string; label: string; type: string }) => void
  email: string
  customerName: string
}

export default function GameStep({ onReveal, email, customerName }: GameStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealedReward, setRevealedReward] = useState<{ key: string; label: string; type: string } | null>(null)

  const handleSelect = useCallback(async (index: number) => {
    if (selectedIndex !== null || loading) return

    setSelectedIndex(index)
    setLoading(true)

    try {
      const res = await fetch("/api/game/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, customerName }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur")

      // Flip the card after a short suspense pause
      setTimeout(() => {
        setRevealedReward(data.reward)
      }, 600)

      // Confetti after the flip completes
      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.6 },
          colors: ["#8B5CF6", "#A855F7", "#FFD200", "#ffffff"],
        })
      }, 1400)

      // Second confetti + transition to result
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.5 },
          colors: ["#8B5CF6", "#FFD200", "#ffffff"],
        })
        onReveal(data.reward)
      }, 2400)
    } catch (err) {
      console.error("Play error:", err)
      setTimeout(() => {
        onReveal({ key: "error", label: "Erreur — réessaie plus tard", type: "manual" })
      }, 1500)
    }
  }, [selectedIndex, loading, email, customerName, onReveal])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-3xl font-bold uppercase text-white sm:text-4xl"
      >
        {selectedIndex === null ? (
          <>CHOISIS <span className="text-[#8B5CF6]">TA CARTE</span></>
        ) : (
          "RÉVÉLATION..."
        )}
      </motion.h2>

      {selectedIndex === null && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-[#888]"
        >
          Une seule contient ta récompense.
        </motion.p>
      )}

      <div className="flex items-center gap-4 sm:gap-6">
        {[0, 1, 2].map((i) => (
          <GameCard
            key={i}
            index={i}
            flipped={selectedIndex === i && revealedReward !== null}
            eliminated={selectedIndex !== null && selectedIndex !== i}
            onClick={() => handleSelect(i)}
            disabled={selectedIndex !== null}
            rewardLabel={selectedIndex === i ? revealedReward?.label : undefined}
            rewardEmoji={selectedIndex === i && revealedReward?.key === "5g_jackpot" ? "🏆" : "🎁"}
          />
        ))}
      </div>
    </motion.div>
  )
}
