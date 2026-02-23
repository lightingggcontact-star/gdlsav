import "@/app/game.css"

export const metadata = {
  title: "Graine de Lascars — Ton cadeau t'attend 🌿",
  description: "Tente ta chance et gagne une récompense !",
}

export default function GameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Background image layer */}
      <div className="game-bg-layer" aria-hidden="true" />

      {/* Ambient smoke rising */}
      <div className="game-ambient-smoke" aria-hidden="true" />
      <div className="game-ambient-smoke" aria-hidden="true" />
      <div className="game-ambient-smoke" aria-hidden="true" />
      <div className="game-ambient-smoke" aria-hidden="true" />
      <div className="game-ambient-smoke" aria-hidden="true" />

      {/* Floating weed leaves */}
      <div className="game-floating-leaf" aria-hidden="true">🍃</div>
      <div className="game-floating-leaf" aria-hidden="true">🌿</div>
      <div className="game-floating-leaf" aria-hidden="true">🍃</div>
      <div className="game-floating-leaf" aria-hidden="true">🌿</div>
      <div className="game-floating-leaf" aria-hidden="true">🍃</div>

      {/* Subtle scanlines */}
      <div className="game-scanlines" aria-hidden="true" />

      {/* Main content */}
      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-8">
        {children}
      </main>
    </>
  )
}
