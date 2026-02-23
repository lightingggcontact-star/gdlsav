"use client"

import { motion } from "framer-motion"

interface ErrorScreenProps {
  message: string
  code?: string
}

export default function ErrorScreen({ message, code }: ErrorScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <div className="text-5xl">
        {code === "GAME_DISABLED" ? "⏸" : "✕"}
      </div>

      <h2 className="text-2xl font-bold uppercase text-[#FF3333]">
        {code === "GAME_DISABLED" ? "JEU EN PAUSE" : "ERREUR"}
      </h2>

      <div className="brutal-panel w-full border-[#FF3333] p-6 shadow-[4px_4px_0px_#FF3333]">
        <p className="text-sm text-[#888]">{message}</p>
      </div>

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
