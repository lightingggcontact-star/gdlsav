import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-90 mx-4">
        <div className="rounded-lg border border-border bg-card p-8 shadow-[0_1px_3px_0_rgba(0,0,0,.04)]">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-gdl-purple flex items-center justify-center">
              <span className="text-white font-bold text-sm">GDL</span>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">GDL SAV</h1>
              <p className="text-sm text-muted-foreground mt-1">Graine de Lascars</p>
            </div>
          </div>
          <LoginForm />
          <p className="text-center text-[11px] text-muted-foreground mt-6">
            Service Après-Vente interne
          </p>
        </div>
      </div>
    </div>
  )
}
