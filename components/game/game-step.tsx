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

function fireConfetti(options: { particleCount: number; spread: number; origin: { y: number; x?: number }; angle?: number }) {
  confetti({
    ...options,
    colors: ["#8B5CF6", "#A855F7", "#FFD200", "#ffffff"],
    ticks: 200,
    gravity: 1.2,
    scalar: 1.1,
  })
}

export default function GameStep({ onReveal, email, customerName }: GameStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealedReward, setRevealedReward] = useState<{ key: string; label: string; type: string } | null>(null)
  const [shake, setShake] = useState(false)

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

      // Suspense pause, then flip
      setTimeout(() => {
        setRevealedReward(data.reward)
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }, 800)

      // First burst — from the sides
      setTimeout(() => {
        fireConfetti({ particleCount: 60, spread: 55, origin: { y: 0.65, x: 0.3 }, angle: 60 })
        fireConfetti({ particleCount: 60, spread: 55, origin: { y: 0.65, x: 0.7 }, angle: 120 })
      }, 1500)

      // Second burst — center big
      setTimeout(() => {
        fireConfetti({ particleCount: 100, spread: 100, origin: { y: 0.55 } })
      }, 1900)

      // Third burst — rain down
      setTimeout(() => {
        fireConfetti({ particleCount: 40, spread: 160, origin: { y: 0.1 } })
        onReveal(data.reward)
      }, 2800)
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
      animate={{
        opacity: 1,
        y: 0,
        x: shake ? [0, -6, 6, -4, 4, -2, 2, 0] : 0,
      }}
      exit={{ opacity: 0, y: -20 }}
      transition={shake ? { duration: 0.5, x: { duration: 0.5 } } : { duration: 0.3 }}
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
        ) : revealedReward ? (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            GAGNÉ !
          </motion.span>
        ) : (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            RÉVÉLATION...
          </motion.span>
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

      <div className="flex items-end gap-4 sm:gap-6">
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
