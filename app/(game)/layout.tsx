import "@/app/game.css"
import { Space_Grotesk } from "next/font/google"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-brutal",
})

export const metadata = {
  title: "Graine de Lascars — Ton cadeau t'attend",
  description: "Tente ta chance et gagne une récompense !",
}

const marqueeText = "GRAINE DE LASCARS \u00B7 TENTE TA CHANCE \u00B7 "

export default function GameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={spaceGrotesk.variable} style={{ fontFamily: "var(--font-brutal), sans-serif" }}>
      {/* Background layer */}
      <div className="game-bg-layer" aria-hidden="true" />

      {/* Smoke wisps */}
      <div className="smoke-layer" aria-hidden="true">
        <div className="smoke-wisp" />
        <div className="smoke-wisp" />
        <div className="smoke-wisp" />
        <div className="smoke-wisp" />
        <div className="smoke-wisp" />
        <div className="smoke-wisp" />
        <div className="smoke-wisp" />
      </div>

      {/* Top marquee ticker */}
      <div className="brutal-marquee fixed top-0 right-0 left-0 z-20 border-b-2 border-white/20 bg-[#0a0a0a] py-2">
        <div className="brutal-marquee-inner text-xs font-bold uppercase tracking-widest text-[#8B5CF6]">
          {marqueeText.repeat(12)}
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 pt-16 pb-8">
        {children}
      </main>

      {/* Bottom violet bar */}
      <div className="fixed right-0 bottom-0 left-0 z-20 h-1 bg-[#8B5CF6]" aria-hidden="true" />
    </div>
  )
}
