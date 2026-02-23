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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-3xl font-bold uppercase text-white sm:text-4xl"
      >
        C&apos;EST BIEN TOI,{" "}
        <span className="text-[#8B5CF6]">{firstName}</span> ?
      </motion.h2>

      {orders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full space-y-3"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#888]">
            Tes dernières commandes
          </p>
          {orders.map((order, i) => (
            <motion.div
              key={order.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="brutal-panel p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{order.name}</span>
                <span className="font-bold text-[#FFD200]">{order.total}&euro;</span>
              </div>
              <p className="mt-1 text-xs text-[#888]">{formatDate(order.date)}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileTap={{ scale: 0.98 }}
        onClick={onConfirm}
        disabled={loading}
        className="brutal-btn mt-2 w-full border-2 border-white bg-[#8B5CF6] px-8 py-4 text-lg text-black shadow-[4px_4px_0px_#000]"
      >
        {loading ? "PRÉPARATION..." : "OUI C'EST MOI"}
      </motion.button>
    </motion.div>
  )
}
