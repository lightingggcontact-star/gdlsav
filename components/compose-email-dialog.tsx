"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, Send, Loader2, X, Users, CheckCircle2, AlertCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getSegments, getSegmentColor } from "@/lib/segments"
import { useSupabase } from "@/lib/supabase/use-supabase"
import type { Segment } from "@/lib/types"

interface Recipient {
  email: string
  name: string
}

interface ComposeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}

export function ComposeEmailDialog({ open, onOpenChange, onSent }: ComposeEmailDialogProps) {
  const supabase = useSupabase()
  const [mode, setMode] = useState<"email" | "segment">("email")
  const [singleEmail, setSingleEmail] = useState("")
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState("")
  const [resolvedEmails, setResolvedEmails] = useState<Recipient[]>([])
  const [resolving, setResolving] = useState(false)
  const [subject, setSubject] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ sent: 0, total: 0, failed: [] as string[] })
  const [sendComplete, setSendComplete] = useState(false)

  // AI assistant
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const aiInputRef = useRef<HTMLTextAreaElement>(null)

  // Load segments when dialog opens
  useEffect(() => {
    if (open) {
      getSegments(supabase).then(setSegments)
    }
  }, [open, supabase])

  // Resolve segment → emails when segment selected
  useEffect(() => {
    if (!selectedSegmentId || mode !== "segment") {
      setResolvedEmails([])
      return
    }

    const segment = segments.find(s => s.id === selectedSegmentId)
    if (!segment || segment.orderIds.length === 0) {
      setResolvedEmails([])
      return
    }

    setResolving(true)
    fetch("/api/shipping")
      .then(res => res.json())
      .then(data => {
        const orders = data.orders || []
        const orderIdSet = new Set(segment.orderIds)

        // Deduplicate by lowercase email
        const emailMap = new Map<string, Recipient>()
        for (const order of orders) {
          if (orderIdSet.has(order.id) && order.customerEmail) {
            const key = order.customerEmail.toLowerCase()
            if (!emailMap.has(key)) {
              emailMap.set(key, {
                email: order.customerEmail,
                name: order.customerName || order.customerEmail,
              })
            }
          }
        }

        setResolvedEmails(Array.from(emailMap.values()))
      })
      .catch(() => {
        toast.error("Erreur chargement commandes")
        setResolvedEmails([])
      })
      .finally(() => setResolving(false))
  }, [selectedSegmentId, segments, mode])

  function removeRecipient(email: string) {
    setResolvedEmails(prev => prev.filter(r => r.email.toLowerCase() !== email.toLowerCase()))
  }

  function getRecipients(): Recipient[] {
    if (mode === "email") {
      const email = singleEmail.trim()
      return email ? [{ email, name: email }] : []
    }
    return resolvedEmails
  }

  const canSend = subject.trim() && bodyText.trim() && getRecipients().length > 0 && !sending

  // ─── AI Generation ───

  async function handleAiGenerate() {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)

    try {
      const segmentName = selectedSegmentId
        ? segments.find(s => s.id === selectedSegmentId)?.name || ""
        : ""
      const recipientCount = getRecipients().length

      const res = await fetch("/api/ai/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Client",
          customerEmail: "",
          ticketSubject: null,
          conversationHistory: [
            {
              from_agent: false,
              senderName: "INSTRUCTIONS",
              body: `CONTEXTE : Tu dois rédiger un EMAIL GÉNÉRAL à envoyer à ${recipientCount > 1 ? `${recipientCount} clients` : "un client"}${segmentName ? ` du segment "${segmentName}"` : ""}.

C'est un email SORTANT, pas une réponse à une conversation. Chaque client reçoit cet email individuellement.

INSTRUCTIONS DE L'AGENT :
${aiPrompt.trim()}

---

IMPORTANT : Génère l'email en 2 parties séparées par la ligne exacte "---OBJET---"

D'abord le CORPS de l'email (comme d'habitude, avec le ton Baba, tutoiement, signature "Baba 🫡").
Puis la ligne "---OBJET---"
Puis l'OBJET de l'email (1 seule ligne, court et clair).

Exemple de format :
Salut !

Blabla le message...

Baba 🫡
---OBJET---
Ton code promo GDL`,
              date: new Date().toISOString(),
            },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const reply = data.reply || ""

        // Parse subject and body
        if (reply.includes("---OBJET---")) {
          const parts = reply.split("---OBJET---")
          setBodyText(parts[0].trim())
          setSubject(parts[1].trim())
        } else {
          // Fallback: everything is body, no subject extracted
          setBodyText(reply.trim())
        }
        toast.success("Email généré par l'IA")
      } else {
        toast.error("Erreur génération IA")
      }
    } catch {
      toast.error("Erreur de connexion IA")
    }
    setAiGenerating(false)
  }

  // ─── Send ───

  async function handleSend() {
    const recipients = getRecipients()
    if (recipients.length === 0 || !subject.trim() || !bodyText.trim()) return

    setSending(true)
    setSendComplete(false)
    const failed: string[] = []
    setProgress({ sent: 0, total: recipients.length, failed: [] })

    for (let i = 0; i < recipients.length; i++) {
      const { email, name } = recipients[i]
      try {
        const res = await fetch("/api/gorgias/tickets/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerEmail: email,
            customerName: name,
            subject: subject.trim(),
            bodyText: bodyText.trim(),
            bodyHtml: `<p>${bodyText.trim().replace(/\n/g, "<br>")}</p>`,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
      } catch {
        failed.push(email)
      }
      setProgress({ sent: i + 1, total: recipients.length, failed: [...failed] })

      // Rate limit: 500ms between sends (Gorgias = 40 req/20s)
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setSending(false)
    setSendComplete(true)

    if (failed.length === 0) {
      toast.success(`${recipients.length} email${recipients.length > 1 ? "s" : ""} envoyé${recipients.length > 1 ? "s" : ""}`)
    } else {
      toast.error(`${failed.length} échec${failed.length > 1 ? "s" : ""} sur ${recipients.length}`)
    }

    onSent()
  }

  function handleOpenChange(isOpen: boolean) {
    if (sending) return // prevent close while sending
    onOpenChange(isOpen)
    if (!isOpen) {
      setTimeout(() => {
        setMode("email")
        setSingleEmail("")
        setSelectedSegmentId("")
        setResolvedEmails([])
        setSubject("")
        setBodyText("")
        setSending(false)
        setProgress({ sent: 0, total: 0, failed: [] })
        setSendComplete(false)
        setAiPrompt("")
        setAiGenerating(false)
      }, 200)
    }
  }

  const selectedSegment = segments.find(s => s.id === selectedSegmentId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#6B2D8B]/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-[#6B2D8B]" />
            </div>
            Nouveau message
          </DialogTitle>
          <DialogDescription>
            Envoyer un email via Gorgias à un client ou un segment entier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-1 bg-[#F5F5F5] rounded-lg p-1">
            <button
              onClick={() => setMode("email")}
              className={cn(
                "flex-1 h-8 rounded-md text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5",
                mode === "email"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mail className="h-3.5 w-3.5" />
              Email unique
            </button>
            <button
              onClick={() => setMode("segment")}
              className={cn(
                "flex-1 h-8 rounded-md text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5",
                mode === "segment"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Segment
            </button>
          </div>

          {/* Recipients */}
          {mode === "email" ? (
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Destinataire</label>
              <input
                type="email"
                value={singleEmail}
                onChange={e => setSingleEmail(e.target.value)}
                placeholder="adresse@email.com"
                className="w-full h-9 px-3 text-[13px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors"
                disabled={sending}
              />
            </div>
          ) : (
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Segment</label>
              <select
                value={selectedSegmentId}
                onChange={e => setSelectedSegmentId(e.target.value)}
                className="w-full h-9 px-3 text-[13px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors"
                disabled={sending}
              >
                <option value="">Sélectionner un segment...</option>
                {segments.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.orderIds.length} commandes)
                  </option>
                ))}
              </select>

              {/* Resolved emails */}
              {resolving ? (
                <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Résolution des emails...
                </div>
              ) : resolvedEmails.length > 0 ? (
                <div className="mt-2">
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    {resolvedEmails.length} destinataire{resolvedEmails.length > 1 ? "s" : ""} unique{resolvedEmails.length > 1 ? "s" : ""}
                    {selectedSegment && (
                      <span className="ml-1">
                        — <span className={cn("inline-flex items-center gap-1", getSegmentColor(selectedSegment.color).text)}>
                          <span className={cn("inline-block w-2 h-2 rounded-full", getSegmentColor(selectedSegment.color).dot)} />
                          {selectedSegment.name}
                        </span>
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                    {resolvedEmails.map(r => (
                      <span
                        key={r.email}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#F0F0F0] rounded-md text-[11px] group"
                      >
                        <span className="truncate max-w-[180px]" title={`${r.name} <${r.email}>`}>
                          {r.email}
                        </span>
                        {!sending && (
                          <button
                            onClick={() => removeRecipient(r.email)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ) : selectedSegmentId && !resolving ? (
                <p className="mt-2 text-[11px] text-muted-foreground/60">Aucun email trouvé pour ce segment</p>
              ) : null}
            </div>
          )}

          {/* AI Assistant */}
          <div className="rounded-lg border border-[#6B2D8B]/20 bg-[#F9F5FC] p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#6B2D8B]" />
              <span className="text-[12px] font-medium text-[#6B2D8B]">Assistant IA</span>
              <span className="text-[11px] text-muted-foreground">— Décris la situation, je génère l'email</span>
            </div>
            <div className="flex gap-1.5">
              <textarea
                ref={aiInputRef}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAiGenerate()
                  }
                }}
                placeholder="Ex: Code promo anniversaire qui n'a pas marché, on s'excuse et on leur donne le code ANNIV10..."
                rows={2}
                className="flex-1 px-2.5 py-2 text-[12px] bg-white border border-[#6B2D8B]/15 rounded-md focus:border-[#6B2D8B]/40 focus:outline-none transition-colors resize-none placeholder:text-muted-foreground/50"
                disabled={aiGenerating || sending}
              />
              <button
                onClick={handleAiGenerate}
                disabled={!aiPrompt.trim() || aiGenerating || sending}
                className="self-end h-9 px-3 rounded-md bg-[#6B2D8B] hover:bg-[#5a2576] text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
              >
                {aiGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Générer
              </button>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Objet</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Objet de l'email"
              className="w-full h-9 px-3 text-[13px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors"
              disabled={sending}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Message</label>
            <textarea
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              placeholder="Votre message..."
              rows={6}
              className="w-full px-3 py-2.5 text-[13px] bg-[#F5F5F5] border border-transparent rounded-lg focus:bg-white focus:border-border focus:outline-none transition-colors resize-none"
              disabled={sending}
            />
          </div>

          {/* Progress */}
          {(sending || sendComplete) && (
            <div className="space-y-2">
              <Progress value={(progress.sent / progress.total) * 100} className="h-2" />
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-1.5">
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B2D8B]" />
                  ) : progress.failed.length === 0 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className="text-muted-foreground">
                    {progress.sent}/{progress.total} envoyé{progress.total > 1 ? "s" : ""}
                  </span>
                </div>
                {progress.failed.length > 0 && (
                  <span className="text-red-500 text-[11px]">
                    {progress.failed.length} échec{progress.failed.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {progress.failed.length > 0 && (
                <div className="text-[11px] text-red-500/80 bg-red-50 rounded-md px-2.5 py-1.5">
                  Échecs : {progress.failed.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            {sendComplete ? "Fermer" : "Annuler"}
          </Button>
          {!sendComplete && (
            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="bg-[#6B2D8B] hover:bg-[#5a2576] text-white"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              {mode === "segment" && resolvedEmails.length > 1
                ? `Envoyer à ${resolvedEmails.length} personnes`
                : "Envoyer"
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
