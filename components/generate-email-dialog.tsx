"use client"

import { useState } from "react"
import { Sparkles, Copy, Mail, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface GenerateEmailDialogProps {
  open: boolean
  onClose: () => void
  customerName: string | null
  customerEmail: string | null
  rating: number
  feedback: string | null
  formName: string
  submissionDate: string
}

export function GenerateEmailDialog({
  open,
  onClose,
  customerName,
  customerEmail,
  rating,
  feedback,
  formName,
  submissionDate,
}: GenerateEmailDialogProps) {
  const [emailContent, setEmailContent] = useState("")
  const [subject, setSubject] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  async function generateEmail() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          rating,
          feedback,
          formName,
          submissionDate,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Erreur génération")
      }
      const data = await res.json()
      setEmailContent(data.email)
      setSubject(data.subject)
      setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(emailContent)
    toast.success("Email copié dans le presse-papier")
  }

  function handleSendMail() {
    if (!customerEmail) return
    const mailtoUrl = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailContent)}`
    window.open(mailtoUrl, "_blank")
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose()
      // Reset state after close animation
      setTimeout(() => {
        setEmailContent("")
        setSubject("")
        setError(null)
        setGenerated(false)
      }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#EAF3FF]">
              <Sparkles className="h-4 w-4 text-[#007AFF]" />
            </div>
            Générer un email de suivi
          </DialogTitle>
          <DialogDescription>
            Claude IA va rédiger un email personnalisé pour{" "}
            {customerName || customerEmail || "ce client"} ({rating}/5)
          </DialogDescription>
        </DialogHeader>

        {/* Context summary */}
        <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1.5">
          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-muted-foreground">Client :</span>
            <span className="font-medium">{customerName || "—"}</span>
            {customerEmail && (
              <span className="text-muted-foreground">{customerEmail}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-muted-foreground">Note :</span>
            <span
              className="font-bold"
              style={{
                color:
                  rating <= 2 ? "#C70A24" : rating === 3 ? "#D97706" : "#047B5D",
              }}
            >
              {rating}/5
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {new Date(submissionDate).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          {feedback && (
            <div className="text-[13px]">
              <span className="text-muted-foreground">Avis : </span>
              <span className="italic">&ldquo;{feedback}&rdquo;</span>
            </div>
          )}
        </div>

        {/* Generated email or generate button */}
        {!generated && !loading && (
          <div className="flex justify-center py-4">
            <Button
              onClick={generateEmail}
              className="gap-2 bg-[#007AFF] hover:bg-[#005FCC] text-white"
            >
              <Sparkles className="h-4 w-4" />
              Générer l&apos;email avec Claude
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
            <p className="text-sm text-muted-foreground">
              Claude rédige l&apos;email...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#FEE8EB] bg-[#FEE8EB]/50 p-4 text-center">
            <p className="text-sm text-[#C70A24]">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={generateEmail}
            >
              Réessayer
            </Button>
          </div>
        )}

        {generated && !loading && (
          <>
            {/* Subject */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
                Objet
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
              />
            </div>

            {/* Email body */}
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
                Corps de l&apos;email
              </label>
              <Textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                className="min-h-[200px] text-sm bg-card"
              />
            </div>
          </>
        )}

        {generated && !loading && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateEmail}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regénérer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copier
            </Button>
            {customerEmail && (
              <Button
                size="sm"
                onClick={handleSendMail}
                className="gap-1.5 bg-[#007AFF] hover:bg-[#005FCC] text-white"
              >
                <Mail className="h-3.5 w-3.5" />
                Ouvrir dans Mail
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
