"use client"

import { useState, useCallback } from "react"
import { AnimatePresence } from "framer-motion"
import LandingStep from "@/components/game/landing-step"
import VerifyStep from "@/components/game/verify-step"
import GameStep from "@/components/game/game-step"
import ResultStep from "@/components/game/result-step"
import AlreadyPlayed from "@/components/game/already-played"
import ErrorScreen from "@/components/game/error-screen"

type Step = "landing" | "verify" | "game" | "result" | "already_played" | "error"

interface Order {
  name: string
  date: string
  total: string
}

interface VerifyData {
  email: string
  customerName: string
  orders: Order[]
}

export default function PlayPage() {
  const [step, setStep] = useState<Step>("landing")
  const [loading, setLoading] = useState(false)
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null)
  const [reward, setReward] = useState<{ key: string; label: string; type: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [errorCode, setErrorCode] = useState("")
  const [alreadyPlayedReward, setAlreadyPlayedReward] = useState("")
  const [landingError, setLandingError] = useState<string | null>(null)

  const handleEmailSubmit = useCallback(async (email: string) => {
    setLoading(true)
    setLandingError(null)

    try {
      const res = await fetch("/api/game/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (data.alreadyPlayed) {
        setAlreadyPlayedReward(data.rewardLabel)
        setStep("already_played")
        return
      }

      if (!res.ok) {
        if (data.code === "NO_ORDERS") {
          setLandingError(data.error)
          return
        }
        setErrorMsg(data.error || "Erreur de vérification")
        setErrorCode(data.code || "")
        setStep("error")
        return
      }

      setVerifyData(data)
      setStep("verify")
    } catch {
      setLandingError("Erreur de connexion. Vérifie ta connexion internet.")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleConfirm = useCallback(() => {
    setStep("game")
  }, [])

  const handleReveal = useCallback((r: { key: string; label: string; type: string }) => {
    setReward(r)
    setStep("result")
  }, [])

  return (
    <AnimatePresence mode="wait">
      {step === "landing" && (
        <LandingStep
          key="landing"
          onSubmit={handleEmailSubmit}
          loading={loading}
          error={landingError}
        />
      )}
      {step === "verify" && verifyData && (
        <VerifyStep
          key="verify"
          customerName={verifyData.customerName}
          orders={verifyData.orders}
          onConfirm={handleConfirm}
          loading={loading}
        />
      )}
      {step === "game" && verifyData && (
        <GameStep
          key="game"
          onReveal={handleReveal}
          email={verifyData.email}
          customerName={verifyData.customerName}
        />
      )}
      {step === "result" && reward && (
        <ResultStep key="result" reward={reward} />
      )}
      {step === "already_played" && (
        <AlreadyPlayed key="already_played" rewardLabel={alreadyPlayedReward} />
      )}
      {step === "error" && (
        <ErrorScreen key="error" message={errorMsg} code={errorCode} />
      )}
    </AnimatePresence>
  )
}
