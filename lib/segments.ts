import type { SupabaseClient } from "@supabase/supabase-js"
import type { Segment } from "./types"

export async function getSegments(supabase: SupabaseClient): Promise<Segment[]> {
  const { data: segments } = await supabase
    .from("segments")
    .select("*, segment_orders(order_id), segment_order_notes(order_id, note)")
    .order("created_at", { ascending: true })

  if (!segments) return []

  return segments.map((s: any) => ({
    id: s.id,
    name: s.name,
    color: s.color as Segment["color"],
    createdAt: s.created_at,
    orderIds: (s.segment_orders || []).map((so: any) => so.order_id),
    notes: Object.fromEntries(
      (s.segment_order_notes || []).map((n: any) => [n.order_id, n.note])
    ),
  }))
}

export async function createSegment(
  supabase: SupabaseClient,
  name: string,
  color: Segment["color"],
  orderIds: string[]
): Promise<Segment> {
  const { data: segment, error } = await supabase
    .from("segments")
    .insert({ name, color })
    .select()
    .single()

  if (error || !segment) throw new Error("Failed to create segment")

  if (orderIds.length > 0) {
    await supabase.from("segment_orders").insert(
      orderIds.map((orderId) => ({ segment_id: segment.id, order_id: orderId }))
    )
  }

  return {
    id: segment.id,
    name: segment.name,
    color: segment.color as Segment["color"],
    createdAt: segment.created_at,
    orderIds,
    notes: {},
  }
}

export async function deleteSegment(supabase: SupabaseClient, id: string) {
  await supabase.from("segments").delete().eq("id", id)
}

export async function addOrdersToSegment(
  supabase: SupabaseClient,
  segmentId: string,
  orderIds: string[]
) {
  await supabase.from("segment_orders").upsert(
    orderIds.map((orderId) => ({ segment_id: segmentId, order_id: orderId })),
    { onConflict: "segment_id,order_id" }
  )
}

export async function removeOrderFromSegment(
  supabase: SupabaseClient,
  segmentId: string,
  orderId: string
) {
  await supabase
    .from("segment_orders")
    .delete()
    .eq("segment_id", segmentId)
    .eq("order_id", orderId)
  await supabase
    .from("segment_order_notes")
    .delete()
    .eq("segment_id", segmentId)
    .eq("order_id", orderId)
}

export async function setNote(
  supabase: SupabaseClient,
  segmentId: string,
  orderId: string,
  note: string
) {
  if (note.trim()) {
    await supabase.from("segment_order_notes").upsert(
      { segment_id: segmentId, order_id: orderId, note, updated_at: new Date().toISOString() },
      { onConflict: "segment_id,order_id" }
    )
  } else {
    await supabase
      .from("segment_order_notes")
      .delete()
      .eq("segment_id", segmentId)
      .eq("order_id", orderId)
  }
}

export async function getSegmentsForOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<Segment[]> {
  const all = await getSegments(supabase)
  return all.filter((s) => s.orderIds.includes(orderId))
}

export const SEGMENT_COLORS: { value: Segment["color"]; label: string; bg: string; text: string; dot: string }[] = [
  { value: "red", label: "Rouge", bg: "bg-red-500/15", text: "text-red-600", dot: "bg-red-500" },
  { value: "blue", label: "Bleu", bg: "bg-blue-500/15", text: "text-blue-600", dot: "bg-blue-500" },
  { value: "green", label: "Vert", bg: "bg-emerald-500/15", text: "text-emerald-600", dot: "bg-emerald-500" },
  { value: "purple", label: "Violet", bg: "bg-purple-500/15", text: "text-purple-600", dot: "bg-purple-500" },
  { value: "orange", label: "Orange", bg: "bg-orange-500/15", text: "text-orange-600", dot: "bg-orange-500" },
  { value: "yellow", label: "Jaune", bg: "bg-amber-500/15", text: "text-amber-600", dot: "bg-amber-500" },
]

export function getSegmentColor(color: Segment["color"]) {
  return SEGMENT_COLORS.find((c) => c.value === color) ?? SEGMENT_COLORS[0]
}

// --- Order notes (independent of segments) ---

export async function getOrderNotes(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await supabase.from("order_notes").select("order_id, note")
  if (!data) return {}
  return Object.fromEntries(data.map((d: any) => [d.order_id, d.note]))
}

export async function getOrderNote(supabase: SupabaseClient, orderId: string): Promise<string> {
  const { data } = await supabase
    .from("order_notes")
    .select("note")
    .eq("order_id", orderId)
    .single()
  return data?.note ?? ""
}

export async function setOrderNote(supabase: SupabaseClient, orderId: string, note: string) {
  if (note.trim()) {
    await supabase.from("order_notes").upsert(
      { order_id: orderId, note, updated_at: new Date().toISOString() },
      { onConflict: "order_id" }
    )
  } else {
    await supabase.from("order_notes").delete().eq("order_id", orderId)
  }
}
