import type { SupabaseClient } from "@supabase/supabase-js"

export type ReviewStatusType = "new" | "contacted" | "resolved"

export interface ReviewStatus {
  status: ReviewStatusType
  updatedAt: string
  note?: string
}

export async function getReviewStatuses(
  supabase: SupabaseClient
): Promise<Record<string, ReviewStatus>> {
  const { data } = await supabase.from("review_statuses").select("*")
  if (!data) return {}
  const result: Record<string, ReviewStatus> = {}
  for (const d of data) {
    result[d.submission_id] = {
      status: d.status as ReviewStatusType,
      updatedAt: d.updated_at,
      note: d.note ?? undefined,
    }
  }
  return result
}

export async function getReviewStatus(
  supabase: SupabaseClient,
  submissionId: string
): Promise<ReviewStatus | null> {
  const { data } = await supabase
    .from("review_statuses")
    .select("*")
    .eq("submission_id", submissionId)
    .single()
  if (!data) return null
  return {
    status: data.status as ReviewStatusType,
    updatedAt: data.updated_at,
    note: data.note ?? undefined,
  }
}

export async function setReviewStatus(
  supabase: SupabaseClient,
  submissionId: string,
  status: ReviewStatusType,
  note?: string
): Promise<void> {
  let finalNote = note
  if (note === undefined) {
    const existing = await getReviewStatus(supabase, submissionId)
    finalNote = existing?.note
  }

  await supabase.from("review_statuses").upsert(
    {
      submission_id: submissionId,
      status,
      note: finalNote ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "submission_id" }
  )
}

export async function setReviewNote(
  supabase: SupabaseClient,
  submissionId: string,
  note: string
): Promise<void> {
  const existing = await getReviewStatus(supabase, submissionId)
  await supabase.from("review_statuses").upsert(
    {
      submission_id: submissionId,
      status: existing?.status ?? "new",
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "submission_id" }
  )
}

export async function clearReviewStatus(
  supabase: SupabaseClient,
  submissionId: string
): Promise<void> {
  await supabase.from("review_statuses").delete().eq("submission_id", submissionId)
}

export const STATUS_CONFIG: Record<ReviewStatusType, { label: string; color: string; bg: string }> = {
  new: { label: "Nouveau", color: "#C70A24", bg: "#FEE8EB" },
  contacted: { label: "Contacté", color: "#8A6116", bg: "#FFF1E3" },
  resolved: { label: "Résolu", color: "#047B5D", bg: "#CDFED4" },
}
