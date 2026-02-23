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
      initial={{ opacity: 0, y: 30 }}
      animate={{
        opacity: eliminated ? 0 : 1,
        y: eliminated ? 20 : 0,
        scale: eliminated ? 0.8 : 1,
        x: eliminated ? (index === 0 ? -50 : index === 2 ? 50 : 0) : 0,
      }}
      transition={{ duration: 0.3 }}
      className="brutal-card"
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className="group relative h-40 w-28 disabled:cursor-default sm:h-52 sm:w-36"
      >
        <div className={`brutal-card-inner ${flipped ? "flipped" : ""}`}>
          {/* Front face — face down */}
          <div className="brutal-card-front border-2 border-white bg-[#141414] shadow-[4px_4px_0px_#8B5CF6] transition-[transform,box-shadow] duration-75 group-not-[:disabled]:group-hover:-translate-x-0.5 group-not-[:disabled]:group-hover:-translate-y-1 group-not-[:disabled]:group-hover:shadow-[6px_6px_0px_#8B5CF6]">
            <span className="text-5xl font-bold text-[#8B5CF6]">?</span>
            <span className="absolute bottom-3 text-[10px] font-bold uppercase tracking-widest text-[#888]">
              {labels[index]}
            </span>
          </div>

          {/* Back face — reward revealed */}
          <div className="brutal-card-back border-2 border-[#FFD200] bg-[#8B5CF6] shadow-[6px_6px_0px_#FFD200]">
            <span className="text-4xl">{rewardEmoji || "🎁"}</span>
            {rewardLabel && (
              <span className="mt-2 px-2 text-center text-[10px] font-bold uppercase leading-tight text-white sm:text-xs">
                {rewardLabel}
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  )
}
