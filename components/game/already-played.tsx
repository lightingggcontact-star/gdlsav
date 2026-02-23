"use client"

import { motion } from "framer-motion"

interface AlreadyPlayedProps {
  rewardLabel: string
}

export default function AlreadyPlayed({ rewardLabel }: AlreadyPlayedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <div className="text-5xl">😏</div>

      <h2
        className="game-neon-glow text-3xl font-bold text-[#4CAF50]"
        style={{ fontFamily: "Bangers, cursive" }}
      >
        T&apos;as déjà tenté ta chance !
      </h2>

      <div className="game-neon-box rounded-xl border border-[#4CAF50]/20 bg-[#1a2a1a] p-6">
        <p className="text-sm text-gray-400">Ta récompense :</p>
        <p className="mt-2 text-xl font-bold text-[#4CAF50]" style={{ fontFamily: "Bangers, cursive" }}>
          {rewardLabel}
        </p>
      </div>

      <p className="text-sm text-gray-500">
        Chaque client ne peut jouer qu&apos;une seule fois. Profite bien de ton gain !
      </p>

      <a
        href="https://grainedelascars.com"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-[#4CAF50]/30 px-8 py-3 text-sm font-medium text-[#4CAF50] transition-colors hover:border-[#4CAF50]/60 hover:bg-[#4CAF50]/5"
      >
        Retour à la boutique
      </a>
    </motion.div>
  )
}
