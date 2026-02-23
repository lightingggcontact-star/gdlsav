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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
        className="text-6xl"
      >
        {isJackpot ? "🏆" : "🎁"}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="brutal-panel w-full p-8"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[#888]">
          Tu as gagné
        </p>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 text-3xl font-bold uppercase text-[#8B5CF6] sm:text-4xl"
        >
          {reward.label}
        </motion.h2>

        {isJackpot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-3"
          >
            <span className="brutal-badge text-sm">JACKPOT</span>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {isManual ? (
          <p className="text-sm text-[#888]">
            Envoie un message à Baba sur WhatsApp pour récupérer ton gain.
          </p>
        ) : (
          <p className="text-sm text-[#888]">
            Ton code promo arrive bientôt. On te contacte très vite.
          </p>
        )}
      </motion.div>

      <motion.a
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        href="https://grainedelascars.com"
        target="_blank"
        rel="noopener noreferrer"
        className="brutal-btn border-2 border-[#8B5CF6] bg-transparent px-8 py-3 text-sm text-[#8B5CF6] shadow-[4px_4px_0px_#8B5CF6] hover:bg-[#8B5CF6] hover:text-black"
      >
        RETOUR À LA BOUTIQUE
      </motion.a>
    </motion.div>
  )
}
