"use client"

import { motion } from "framer-motion"

interface ErrorScreenProps {
  message: string
  code?: string
}

export default function ErrorScreen({ message, code }: ErrorScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <div className="text-5xl">
        {code === "GAME_DISABLED" ? "⏸️" : "😕"}
      </div>

      <h2
        className="text-2xl font-bold text-red-400"
        style={{ fontFamily: "Bangers, cursive" }}
      >
        {code === "GAME_DISABLED" ? "Jeu en pause" : "Oups..."}
      </h2>

      <p className="text-gray-400">{message}</p>

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
