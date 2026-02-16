"use client"

import { useState, useEffect, useCallback } from "react"
import { BookOpen, Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase/use-supabase"
import { toast } from "sonner"

interface Template {
  id: string
  title: string
  body: string
  category: string
  sort_order: number
}

const CATEGORIES = [
  { key: "all", label: "Tous" },
  { key: "livraison", label: "Livraison" },
  { key: "retour", label: "Retour" },
  { key: "general", label: "Général" },
] as const

function processTemplate(body: string, firstName: string, trackingUrl?: string): string {
  let result = body
  result = result.replace(/\{\{prenom\}\}/g, firstName || "")
  result = result.replace(/\{\{tracking_url\}\}/g, trackingUrl || "[lien de suivi]")
  return result
}

interface QuickReplyPickerProps {
  onSelect: (text: string) => void
  customerFirstName: string
  trackingUrl?: string
}

export function QuickReplyPicker({ onSelect, customerFirstName, trackingUrl }: QuickReplyPickerProps) {
  const supabase = useSupabase()
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState("all")

  // CRUD state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState("")
  const [formBody, setFormBody] = useState("")
  const [formCategory, setFormCategory] = useState("general")
  const [saving, setSaving] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("quick_reply_templates")
      .select("*")
      .order("sort_order", { ascending: true })
    if (data) setTemplates(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (open) fetchTemplates()
  }, [open, fetchTemplates])

  const filtered = activeCategory === "all"
    ? templates
    : templates.filter(t => t.category === activeCategory)

  const handleSelect = (template: Template) => {
    const processed = processTemplate(template.body, customerFirstName, trackingUrl)
    onSelect(processed)
    setOpen(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from("quick_reply_templates").delete().eq("id", id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success("Template supprimé")
  }

  const startEdit = (template: Template) => {
    setEditingId(template.id)
    setFormTitle(template.title)
    setFormBody(template.body)
    setFormCategory(template.category)
    setCreating(false)
  }

  const startCreate = () => {
    setCreating(true)
    setEditingId(null)
    setFormTitle("")
    setFormBody("")
    setFormCategory("general")
  }

  const cancelForm = () => {
    setCreating(false)
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formBody.trim()) return
    setSaving(true)

    if (editingId) {
      const { error } = await supabase
        .from("quick_reply_templates")
        .update({ title: formTitle.trim(), body: formBody.trim(), category: formCategory, updated_at: new Date().toISOString() })
        .eq("id", editingId)
      if (!error) {
        setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, title: formTitle.trim(), body: formBody.trim(), category: formCategory } : t))
        toast.success("Template modifié")
      }
    } else {
      const { data, error } = await supabase
        .from("quick_reply_templates")
        .insert({ title: formTitle.trim(), body: formBody.trim(), category: formCategory, sort_order: templates.length })
        .select()
        .single()
      if (!error && data) {
        setTemplates(prev => [...prev, data])
        toast.success("Template créé")
      }
    }

    setSaving(false)
    cancelForm()
  }

  const isFormMode = creating || editingId

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 transition-all">
          <BookOpen className="h-3.5 w-3.5" />
          Templates
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[360px] p-0 rounded-2xl border-black/[0.08] bg-white/90 backdrop-blur-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
          <span className="text-[13px] font-semibold">Réponses rapides</span>
          <button
            onClick={startCreate}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Nouveau
          </button>
        </div>

        {/* Category tabs */}
        {!isFormMode && (
          <div className="flex gap-1 px-3 py-2 border-b border-black/[0.04]">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                  activeCategory === cat.key
                    ? "bg-[#007AFF] text-white"
                    : "text-muted-foreground hover:bg-black/[0.04]"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Create / Edit form */}
        {isFormMode && (
          <div className="p-3 border-b border-black/[0.06] space-y-2">
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Nom du template..."
              className="w-full text-[12px] px-3 py-2 rounded-xl bg-black/[0.03] border border-black/[0.06] outline-none focus:border-[#007AFF]/30 transition-colors"
            />
            <textarea
              value={formBody}
              onChange={e => setFormBody(e.target.value)}
              placeholder="Contenu du template... ({{prenom}} et {{tracking_url}} seront remplacés)"
              rows={4}
              className="w-full text-[12px] px-3 py-2 rounded-xl bg-black/[0.03] border border-black/[0.06] outline-none focus:border-[#007AFF]/30 transition-colors resize-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="text-[11px] px-2 py-1.5 rounded-lg bg-black/[0.03] border border-black/[0.06] outline-none"
              >
                <option value="livraison">Livraison</option>
                <option value="retour">Retour</option>
                <option value="general">Général</option>
              </select>
              <div className="flex-1" />
              <button onClick={cancelForm} className="px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-black/[0.04] transition-colors">
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formBody.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#007AFF] text-white hover:bg-[#005FCC] disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {editingId ? "Modifier" : "Créer"}
              </button>
            </div>
          </div>
        )}

        {/* Template list */}
        <div className="max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-muted-foreground">
              Aucun template{activeCategory !== "all" ? " dans cette catégorie" : ""}
            </div>
          ) : (
            filtered.map(template => (
              <div
                key={template.id}
                className="group px-4 py-2.5 border-b border-black/[0.03] hover:bg-[#007AFF]/[0.04] transition-colors cursor-pointer"
                onClick={() => handleSelect(template)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-foreground flex-1 truncate">{template.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/[0.04] text-muted-foreground shrink-0">
                    {template.category}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(template) }}
                      className="p-1 rounded-md text-muted-foreground hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(template.id) }}
                      className="p-1 rounded-md text-muted-foreground hover:text-[#C70A24] hover:bg-[#FEE8EB] transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2 leading-relaxed">
                  {processTemplate(template.body, customerFirstName, trackingUrl).slice(0, 120)}...
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
