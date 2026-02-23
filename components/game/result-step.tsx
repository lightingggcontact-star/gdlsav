"use client"

import { motion } from "framer-motion"

interface ResultStepProps {
  reward: { key: string; label: string; type: string }
}

export default function ResultStep({ reward }: ResultStepProps) {
  const isJackpot = reward.key === "5g_jackpot"
  const isManual = reward.type === "manual"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="text-6xl"
      >
        {isJackpot ? "🏆" : "🎉"}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="game-neon-box w-full rounded-2xl border border-[#4CAF50]/30 bg-[#1a2a1a] p-8"
      >
        <p className="text-sm uppercase tracking-wider text-gray-400">Tu as gagné</p>
        <motion.h2
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
          className="game-neon-glow mt-3 text-3xl font-bold text-[#4CAF50] sm:text-4xl"
          style={{ fontFamily: "Bangers, cursive" }}
        >
          {reward.label}
        </motion.h2>

        {isJackpot && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-2 text-[#FFD700]"
            style={{ fontFamily: "Bangers, cursive" }}
          >
            JACKPOT ! 🔥🔥🔥
          </motion.p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {isManual ? (
          <p className="text-gray-400">
            Envoie un message à Baba sur WhatsApp pour récupérer ton gain !
          </p>
        ) : (
          <p className="text-gray-400">
            Ton code promo arrive bientôt ! On te contacte très vite.
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="flex w-full flex-col gap-3"
      >
        <a
          href="https://grainedelascars.com"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#4CAF50]/30 px-8 py-3 text-sm font-medium text-[#4CAF50] transition-colors hover:border-[#4CAF50]/60 hover:bg-[#4CAF50]/5"
        >
          Retour à la boutique
        </a>
      </motion.div>
    </motion.div>
  )
}
