"use client"

import { motion } from "framer-motion"

interface PochonProps {
  index: number
  selected: boolean
  eliminated: boolean
  onClick: () => void
  disabled: boolean
}

export default function Pochon({ index, selected, eliminated, onClick, disabled }: PochonProps) {
  const labels = ["A", "B", "C"]

  if (eliminated) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.5, y: 20 }}
        transition={{ duration: 0.5 }}
        className="flex h-32 w-24 items-center justify-center sm:h-40 sm:w-32"
      />
    )
  }

  if (selected) {
    return (
      <motion.div
        className="pochon-shake flex flex-col items-center gap-2"
        animate={{ scale: [1, 1.2, 1.15] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="game-neon-box relative flex h-36 w-28 cursor-default items-center justify-center rounded-2xl border-2 border-[#4CAF50] bg-gradient-to-b from-[#388E3C]/40 to-[#1a2a1a] sm:h-44 sm:w-36"
          animate={{
            borderColor: ["#4CAF50", "#FFD700", "#4CAF50"],
            boxShadow: [
              "0 0 15px rgba(76,175,80,0.3)",
              "0 0 30px rgba(255,215,0,0.5)",
              "0 0 15px rgba(76,175,80,0.3)",
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.span
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-4xl"
          >
            🎁
          </motion.span>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.08, y: -5 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      animate={{ y: [0, -8, 0] }}
      transition={{ y: { duration: 2 + index * 0.3, repeat: Infinity, ease: "easeInOut" } }}
      className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed"
    >
      <div className="game-neon-box relative flex h-32 w-24 items-center justify-center rounded-2xl border border-[#4CAF50]/40 bg-gradient-to-b from-[#1a2a1a] to-[#111611] transition-all group-hover:border-[#4CAF50]/80 sm:h-40 sm:w-32">
        <span className="text-3xl font-bold text-[#4CAF50]/60 group-hover:text-[#4CAF50]" style={{ fontFamily: "Bangers, cursive" }}>
          ?
        </span>
      </div>
      <span className="text-xs text-gray-500">Pochon {labels[index]}</span>
    </motion.button>
  )
}
