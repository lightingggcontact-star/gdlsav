"use client"

import { motion } from "framer-motion"

interface Order {
  name: string
  date: string
  total: string
}

interface VerifyStepProps {
  customerName: string
  orders: Order[]
  onConfirm: () => void
  loading: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default function VerifyStep({ customerName, orders, onConfirm, loading }: VerifyStepProps) {
  const firstName = customerName.split(" ")[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="game-neon-glow text-3xl font-bold text-[#4CAF50] sm:text-4xl"
        style={{ fontFamily: "Bangers, cursive" }}
      >
        C&apos;est bien toi, {firstName} ?
      </motion.h2>

      {orders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full space-y-3"
        >
          <p className="text-sm text-gray-400">Tes dernières commandes :</p>
          {orders.map((order, i) => (
            <motion.div
              key={order.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="game-neon-box rounded-xl border border-[#4CAF50]/20 bg-[#1a2a1a] p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{order.name}</span>
                <span className="text-sm font-medium text-[#4CAF50]">{order.total}€</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{formatDate(order.date)}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onConfirm}
        disabled={loading}
        className="game-btn-pulse mt-2 w-full rounded-full bg-[#4CAF50] px-8 py-4 text-lg font-bold text-black transition-colors hover:bg-[#66BB6A] disabled:opacity-50 disabled:animate-none"
      >
        {loading ? "Préparation..." : "Oui c'est moi ! 🎯"}
      </motion.button>
    </motion.div>
  )
}
