"use client"

import { motion } from "framer-motion"

interface AlreadyPlayedProps {
  rewardLabel: string
}

export default function AlreadyPlayed({ rewardLabel }: AlreadyPlayedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <div className="text-5xl">👀</div>

      <h2 className="text-3xl font-bold uppercase text-white">
        DÉJÀ <span className="text-[#8B5CF6]">JOUÉ</span>
      </h2>

      <div className="brutal-panel w-full p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#888]">
          Ta récompense
        </p>
        <p className="mt-2 text-xl font-bold uppercase text-[#FFD200]">
          {rewardLabel}
        </p>
      </div>

      <p className="text-sm text-[#888]">
        Chaque client ne peut jouer qu&apos;une seule fois. Profite bien de ton gain.
      </p>

      <a
        href="https://grainedelascars.com"
        target="_blank"
        rel="noopener noreferrer"
        className="brutal-btn border-2 border-[#8B5CF6] bg-transparent px-8 py-3 text-sm text-[#8B5CF6] shadow-[4px_4px_0px_#8B5CF6] hover:bg-[#8B5CF6] hover:text-black"
      >
        RETOUR À LA BOUTIQUE
      </a>
    </motion.div>
  )
}
