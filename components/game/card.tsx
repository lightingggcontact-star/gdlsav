"use client"

import { motion } from "framer-motion"

interface GameCardProps {
  index: number
  flipped: boolean
  eliminated: boolean
  onClick: () => void
  disabled: boolean
  rewardLabel?: string
  rewardEmoji?: string
}

export default function GameCard({
  index,
  flipped,
  eliminated,
  onClick,
  disabled,
  rewardLabel,
  rewardEmoji,
}: GameCardProps) {
  const labels = ["CARTE 1", "CARTE 2", "CARTE 3"]

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotate: index === 0 ? -8 : index === 2 ? 8 : 0 }}
      animate={{
        opacity: eliminated ? 0 : 1,
        y: eliminated ? 40 : 0,
        scale: eliminated ? 0.6 : 1,
        x: eliminated ? (index === 0 ? -80 : index === 2 ? 80 : 0) : 0,
        rotate: eliminated ? (index === 0 ? -20 : index === 2 ? 20 : 0) : 0,
      }}
      transition={{
        duration: eliminated ? 0.4 : 0.5,
        delay: eliminated ? 0 : index * 0.12,
        type: eliminated ? "tween" : "spring",
        stiffness: 200,
        damping: 15,
      }}
      className="brutal-card"
    >
      <motion.button
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled ? {} : { y: -8, scale: 1.05 }}
        whileTap={disabled ? {} : { scale: 0.92, y: 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="group relative h-44 w-30 disabled:cursor-default sm:h-56 sm:w-40"
      >
        <div className={`brutal-card-inner ${flipped ? "flipped" : ""}`}>
          {/* Front face — face down */}
          <div className="brutal-card-front border-2 border-white bg-[#141414] shadow-[4px_4px_0px_#8B5CF6]">
            {/* Decorative corner marks */}
            <span className="absolute top-2 left-2 text-[8px] font-bold text-[#8B5CF6]/40">+</span>
            <span className="absolute top-2 right-2 text-[8px] font-bold text-[#8B5CF6]/40">+</span>
            <span className="absolute bottom-8 left-2 text-[8px] font-bold text-[#8B5CF6]/40">+</span>
            <span className="absolute right-2 bottom-8 text-[8px] font-bold text-[#8B5CF6]/40">+</span>

            {/* Inner border */}
            <div className="absolute inset-2 bottom-8 border border-[#8B5CF6]/20" />

            <span className="text-5xl font-bold text-[#8B5CF6] sm:text-6xl">?</span>
            <span className="absolute bottom-2.5 text-[10px] font-bold uppercase tracking-widest text-[#888]">
              {labels[index]}
            </span>
          </div>

          {/* Back face — reward revealed */}
          <div className="brutal-card-back border-2 border-[#FFD200] bg-[#8B5CF6] shadow-[6px_6px_0px_#FFD200]">
            {/* Decorative corner marks */}
            <span className="absolute top-2 left-2 text-[8px] font-bold text-white/40">+</span>
            <span className="absolute top-2 right-2 text-[8px] font-bold text-white/40">+</span>
            <span className="absolute bottom-2 left-2 text-[8px] font-bold text-white/40">+</span>
            <span className="absolute right-2 bottom-2 text-[8px] font-bold text-white/40">+</span>

            <span className="text-5xl">{rewardEmoji || "🎁"}</span>
            {rewardLabel && (
              <span className="mt-3 px-3 text-center text-[10px] font-bold uppercase leading-tight text-white sm:text-xs">
                {rewardLabel}
              </span>
            )}
          </div>
        </div>
      </motion.button>
    </motion.div>
  )
}
