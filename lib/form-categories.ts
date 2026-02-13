import type { SupabaseClient } from "@supabase/supabase-js"

export interface FormCategory {
  id: string
  name: string
  color: string // hex color
  formIds: string[]
}

export const CATEGORY_COLORS = [
  { value: "#6B2D8B", label: "Violet" },
  { value: "#005BD3", label: "Bleu" },
  { value: "#047B5D", label: "Vert" },
  { value: "#E67C00", label: "Orange" },
  { value: "#C70A24", label: "Rouge" },
  { value: "#616161", label: "Gris" },
]

export async function getCategories(supabase: SupabaseClient): Promise<FormCategory[]> {
  const { data: cats } = await supabase
    .from("form_categories")
    .select("*, form_category_assignments(form_id)")
    .order("created_at", { ascending: true })

  if (!cats) return []

  return cats.map((c: any) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    formIds: (c.form_category_assignments || []).map((a: any) => a.form_id),
  }))
}

export async function createCategory(
  supabase: SupabaseClient,
  name: string,
  color: string
): Promise<FormCategory> {
  const { data: cat, error } = await supabase
    .from("form_categories")
    .insert({ name, color })
    .select()
    .single()

  if (error || !cat) throw new Error("Failed to create category")

  return { id: cat.id, name: cat.name, color: cat.color, formIds: [] }
}

export async function deleteCategory(supabase: SupabaseClient, id: string) {
  await supabase.from("form_categories").delete().eq("id", id)
}

export async function renameCategory(supabase: SupabaseClient, id: string, name: string) {
  await supabase.from("form_categories").update({ name }).eq("id", id)
}

export async function addFormToCategory(
  supabase: SupabaseClient,
  categoryId: string,
  formId: string
) {
  await supabase.from("form_category_assignments").delete().eq("form_id", formId)
  await supabase.from("form_category_assignments").insert({
    form_id: formId,
    category_id: categoryId,
  })
}

export async function removeFormFromCategory(supabase: SupabaseClient, formId: string) {
  await supabase.from("form_category_assignments").delete().eq("form_id", formId)
}

export async function getCategoryForForm(
  supabase: SupabaseClient,
  formId: string
): Promise<FormCategory | undefined> {
  const cats = await getCategories(supabase)
  return cats.find((c) => c.formIds.includes(formId))
}

// --- Pinned forms ---

export async function getPinnedForms(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("pinned_forms")
    .select("form_id")
    .order("pinned_at", { ascending: true })
  if (!data) return []
  return data.map((d: any) => d.form_id)
}

export async function togglePin(supabase: SupabaseClient, formId: string) {
  const pins = await getPinnedForms(supabase)
  if (pins.includes(formId)) {
    await supabase.from("pinned_forms").delete().eq("form_id", formId)
  } else {
    await supabase.from("pinned_forms").insert({ form_id: formId })
  }
}

export async function isPinned(supabase: SupabaseClient, formId: string): Promise<boolean> {
  const { data } = await supabase
    .from("pinned_forms")
    .select("form_id")
    .eq("form_id", formId)
    .single()
  return !!data
}
