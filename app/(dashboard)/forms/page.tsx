"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  RefreshCw,
  FileText,
  ChevronDown,
  Plus,
  FolderOpen,
  Trash2,
  MoreHorizontal,
  Eye,
  EyeOff,
  Pin,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useSupabase } from "@/lib/supabase/use-supabase"
import {
  getCategories,
  createCategory,
  deleteCategory,
  addFormToCategory,
  removeFormFromCategory,
  getPinnedForms,
  togglePin,
  CATEGORY_COLORS,
  type FormCategory,
} from "@/lib/form-categories"

interface FilloutForm {
  name: string
  formId: string
  isPublished: boolean
  id: number
  tags: string[]
}

interface FormScore {
  avgRating: number | null
  totalResponses: number
  hasRating: boolean
}

function ratingColor(avg: number): { bg: string; text: string } {
  if (avg >= 4) return { bg: "bg-[#CDFED4]", text: "text-[#047B5D]" }
  if (avg >= 3) return { bg: "bg-[#FFF1E3]", text: "text-[#8A6116]" }
  return { bg: "bg-[#FEE8EB]", text: "text-[#C70A24]" }
}

export default function FormsPage() {
  const supabase = useSupabase()
  const [forms, setForms] = useState<FilloutForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showDrafts, setShowDrafts] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [categories, setCategories] = useState<FormCategory[]>([])
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0].value)
  const [assignFormId, setAssignFormId] = useState<string | null>(null)

  // Scores — load from cache first, refresh in background
  const [scores, setScores] = useState<Record<string, FormScore>>({})
  const [scoresLoading, setScoresLoading] = useState(false)

  useEffect(() => {
    async function loadInitial() {
      const [cats, pins] = await Promise.all([
        getCategories(supabase),
        getPinnedForms(supabase),
      ])
      setCategories(cats)
      setPinnedIds(pins)
    }
    loadInitial()
    // Load cached scores immediately
    try {
      const cached = localStorage.getItem("gdl-scores-cache")
      if (cached) {
        const { scores: cachedScores } = JSON.parse(cached)
        if (cachedScores) setScores(cachedScores)
      }
    } catch { /* ignore */ }
  }, [supabase])

  async function fetchForms() {
    try {
      const res = await fetch("/api/fillout/forms")
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? "Erreur serveur")
      }
      const data = await res.json()
      setForms(data.forms)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    }
  }

  async function fetchScores() {
    setScoresLoading(true)
    try {
      const res = await fetch("/api/fillout/scores")
      if (res.ok) {
        const data = await res.json()
        setScores(data.scores || {})
        // Cache for instant load next time
        try { localStorage.setItem("gdl-scores-cache", JSON.stringify(data)) } catch { /* ignore */ }
      }
    } catch {
      // silent
    } finally {
      setScoresLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchForms().finally(() => setLoading(false))
    fetchScores()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchForms(), fetchScores()])
    setRefreshing(false)
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return
    await createCategory(supabase, newCatName.trim(), newCatColor)
    setCategories(await getCategories(supabase))
    setNewCatName("")
    setNewCatColor(CATEGORY_COLORS[0].value)
    setCreateOpen(false)
  }

  async function handleDeleteCategory(id: string) {
    await deleteCategory(supabase, id)
    setCategories(await getCategories(supabase))
  }

  async function handleAssign(formId: string, categoryId: string | null) {
    if (categoryId) await addFormToCategory(supabase, categoryId, formId)
    else await removeFormFromCategory(supabase, formId)
    setCategories(await getCategories(supabase))
    setAssignFormId(null)
  }

  async function handleTogglePin(formId: string) {
    await togglePin(supabase, formId)
    setPinnedIds(await getPinnedForms(supabase))
  }

  function toggleCollapse(catId: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const published = forms.filter((f) => f.isPublished)
  const displayed = useMemo(() => {
    let list = showDrafts ? forms : published
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return list
  }, [forms, published, showDrafts, searchQuery])

  // Split: pinned + categorized + uncategorized
  const { pinned, categorized, uncategorized } = useMemo(() => {
    const assignedIds = new Set(categories.flatMap((c) => c.formIds))
    const pinnedSet = new Set(pinnedIds)

    const pinnedForms = displayed.filter((f) => pinnedSet.has(f.formId))
    const nonPinned = displayed.filter((f) => !pinnedSet.has(f.formId))
    const uncat = nonPinned.filter((f) => !assignedIds.has(f.formId))
    const catGroups = categories.map((cat) => ({
      ...cat,
      forms: nonPinned.filter((f) => cat.formIds.includes(f.formId)),
    }))
    return { pinned: pinnedForms, categorized: catGroups, uncategorized: uncat }
  }, [categories, displayed, pinnedIds])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Formulaires</h1>
        <div className="rounded-lg border border-border bg-[#FEE8EB] p-8 text-center">
          <p className="text-[#C70A24] font-medium">{error}</p>
          <Button variant="outline" className="mt-4 bg-card" onClick={() => { setLoading(true); setError(null); fetchForms().finally(() => setLoading(false)) }}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  function FormCard({ form }: { form: FilloutForm }) {
    const score = scores[form.formId]
    const isPinnedForm = pinnedIds.includes(form.formId)
    const hasRating = score?.avgRating != null

    return (
      <div className="rounded-lg border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,.05)] hover:shadow-md transition-all group relative flex flex-col">
        {/* Top actions bar */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 z-10">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTogglePin(form.formId) }}
            className={cn(
              "p-1.5 rounded-md transition-all",
              isPinnedForm
                ? "text-gdl-purple bg-[#EAF3FF]"
                : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-secondary opacity-0 group-hover:opacity-100"
            )}
          >
            <Pin className="h-3 w-3" />
          </button>
          <Popover open={assignFormId === form.formId} onOpenChange={(o) => setAssignFormId(o ? form.formId : null)}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5">
              <p className="text-[11px] font-medium text-muted-foreground px-2 py-1.5">Déplacer vers</p>
              <button onClick={() => handleAssign(form.formId, null)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-secondary transition-colors">
                <div className="w-3 h-3 rounded-full border-2 border-border" />
                Sans catégorie
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => handleAssign(form.formId, cat.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-secondary transition-colors">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <Link href={`/forms/${form.formId}`} className="flex flex-col flex-1 p-4">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
            form.isPublished ? "bg-[#EAF3FF] text-gdl-purple" : "bg-secondary text-muted-foreground"
          )}>
            <FileText className="h-5 w-5" />
          </div>

          {/* Name */}
          <p className="text-sm font-medium line-clamp-2 mb-1">{form.name}</p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-auto pt-2">
            {score?.totalResponses != null && (
              <span className="text-[11px] text-muted-foreground">{score.totalResponses} rép.</span>
            )}
            {!form.isPublished && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">Brouillon</span>
            )}
          </div>

          {/* Satisfaction bar */}
          {hasRating && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn("text-lg font-bold", ratingColor(score.avgRating!).text)}>
                  {score.avgRating!.toFixed(1)}/5
                </span>
                <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded", ratingColor(score.avgRating!).bg, ratingColor(score.avgRating!).text)}>
                  {score.avgRating! >= 4 ? "Bon" : score.avgRating! >= 3 ? "Moyen" : "Critique"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(score.avgRating! / 5) * 100}%`,
                    backgroundColor: score.avgRating! >= 4 ? "#047B5D" : score.avgRating! >= 3 ? "#E67C00" : "#C70A24",
                  }}
                />
              </div>
            </div>
          )}
          {scoresLoading && !score && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="h-5 w-16 rounded bg-secondary animate-pulse mb-1.5" />
              <div className="h-1.5 rounded-full bg-secondary animate-pulse" />
            </div>
          )}
        </Link>
      </div>
    )
  }

  function FormSection({ title, icon, forms: sectionForms, titleColor, collapsible, catId, onDelete }: {
    title: string; icon?: React.ReactNode; forms: FilloutForm[]; titleColor?: string
    collapsible?: boolean; catId?: string; onDelete?: () => void
  }) {
    const collapsed = catId ? collapsedCats.has(catId) : false
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => catId && toggleCollapse(catId)} className="flex items-center gap-2 flex-1 min-w-0">
            {icon}
            <span className={cn("text-[13px] font-semibold truncate", titleColor || "text-foreground")}>{title}</span>
            <span className="text-[11px] text-muted-foreground">{sectionForms.length}</span>
            {collapsible && (
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
            )}
          </button>
          {onDelete && (
            <button onClick={onDelete} className="p-1 rounded text-muted-foreground/40 hover:text-[#C70A24] hover:bg-[#FEE8EB] transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!collapsed && (
          sectionForms.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">Aucun formulaire</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sectionForms.map((form) => <FormCard key={form.formId} form={form} />)}
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Formulaires</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {published.length} publiés · {pinned.length} épinglé{pinned.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="gap-2 text-[13px]">
            <Plus className="h-3.5 w-3.5" /> Catégorie
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDrafts(!showDrafts)} className="gap-2 text-[13px]">
            {showDrafts ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showDrafts ? "Masquer brouillons" : "Brouillons"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un formulaire..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border h-9 text-sm"
        />
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <FormSection
          title="Épinglés"
          icon={<Pin className="h-3.5 w-3.5 text-gdl-purple" />}
          forms={pinned}
          titleColor="text-gdl-purple"
        />
      )}

      {/* Categories */}
      {categorized.map((cat) => (
        <FormSection
          key={cat.id}
          title={cat.name}
          icon={<div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
          forms={cat.forms}
          collapsible
          catId={cat.id}
          onDelete={() => handleDeleteCategory(cat.id)}
        />
      ))}

      {/* Uncategorized */}
      {uncategorized.length > 0 && (
        <FormSection
          title={categories.length > 0 ? "Sans catégorie" : "Tous les formulaires"}
          icon={categories.length > 0 ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> : undefined}
          forms={uncategorized}
          titleColor={categories.length > 0 ? "text-muted-foreground" : undefined}
        />
      )}

      {/* Create category dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-[13px] font-medium text-muted-foreground mb-1.5 block">Nom</label>
              <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ex: Avis produits" className="h-9" onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} />
            </div>
            <div>
              <label className="text-[13px] font-medium text-muted-foreground mb-1.5 block">Couleur</label>
              <div className="flex gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button key={c.value} onClick={() => setNewCatColor(c.value)} className={cn("w-8 h-8 rounded-lg transition-all", newCatColor === c.value ? "ring-2 ring-offset-2 ring-foreground/20 scale-110" : "hover:scale-105")} style={{ backgroundColor: c.value }} title={c.label} />
                ))}
              </div>
            </div>
            <Button onClick={handleCreateCategory} disabled={!newCatName.trim()} className="w-full bg-gdl-purple text-white hover:bg-gdl-purple/90">
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
