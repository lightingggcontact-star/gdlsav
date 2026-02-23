import type { SupabaseClient } from "@supabase/supabase-js"
import type { Renvoi, RenvoiReason, RenvoiStatus } from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): Renvoi {
  return {
    id: row.id,
    createdAt: row.created_at,
    shopifyOrderId: row.shopify_order_id,
    orderName: row.order_name,
    orderTotal: row.order_total,
    customerName: row.customer_name,
    customerEmail: row.customer_email ?? "",
    reason: row.reason as RenvoiReason,
    status: row.status as RenvoiStatus,
    trackingNumber: row.tracking_number ?? "",
    note: row.note ?? "",
    renvoiDate: row.renvoi_date,
    colisRevenu: row.colis_revenu ?? false,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getRenvois(supabase: SupabaseClient): Promise<Renvoi[]> {
  const { data } = await supabase
    .from("renvois")
    .select("*")
    .order("renvoi_date", { ascending: false })

  if (!data) return []
  return data.map(mapRow)
}

export async function createRenvoi(
  supabase: SupabaseClient,
  input: {
    shopifyOrderId: string
    orderName: string
    orderTotal: string
    customerName: string
    customerEmail: string
    reason: RenvoiReason
    trackingNumber?: string
    note?: string
    renvoiDate?: string
  }
): Promise<Renvoi> {
  const { data, error } = await supabase
    .from("renvois")
    .insert({
      shopify_order_id: input.shopifyOrderId,
      order_name: input.orderName,
      order_total: input.orderTotal,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      reason: input.reason,
      tracking_number: input.trackingNumber ?? "",
      note: input.note ?? "",
      renvoi_date: input.renvoiDate ?? new Date().toISOString().split("T")[0],
    })
    .select()
    .single()

  if (error || !data) throw new Error("Impossible de créer le renvoi")
  return mapRow(data)
}

export async function updateRenvoiStatus(
  supabase: SupabaseClient,
  id: string,
  status: RenvoiStatus
) {
  await supabase.from("renvois").update({ status }).eq("id", id)
}

export async function updateRenvoiTracking(
  supabase: SupabaseClient,
  id: string,
  trackingNumber: string
) {
  await supabase.from("renvois").update({ tracking_number: trackingNumber }).eq("id", id)
}

export async function updateRenvoiNote(
  supabase: SupabaseClient,
  id: string,
  note: string
) {
  await supabase.from("renvois").update({ note }).eq("id", id)
}

export async function updateRenvoiColisRevenu(
  supabase: SupabaseClient,
  id: string,
  colisRevenu: boolean
) {
  await supabase.from("renvois").update({ colis_revenu: colisRevenu }).eq("id", id)
}

export async function deleteRenvoi(supabase: SupabaseClient, id: string) {
  await supabase.from("renvois").delete().eq("id", id)
}

export const REASON_OPTIONS: { value: RenvoiReason; label: string; emoji: string }[] = [
  { value: "colis_perdu", label: "Colis perdu", emoji: "📦" },
  { value: "colis_endommage", label: "Colis endommagé", emoji: "💔" },
  { value: "erreur_preparation", label: "Erreur préparation", emoji: "⚠️" },
  { value: "retour_client", label: "Retour client", emoji: "↩️" },
  { value: "autre", label: "Autre", emoji: "📋" },
]

export const STATUS_OPTIONS: { value: RenvoiStatus; label: string; bg: string; text: string }[] = [
  { value: "en_cours", label: "En cours", bg: "bg-amber-500/15", text: "text-amber-600" },
  { value: "expedie", label: "Expédié", bg: "bg-blue-500/15", text: "text-blue-600" },
  { value: "livre", label: "Livré", bg: "bg-emerald-500/15", text: "text-emerald-600" },
  { value: "annule", label: "Annulé", bg: "bg-red-500/15", text: "text-red-600" },
]

export function getReasonLabel(reason: RenvoiReason): string {
  return REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason
}

export function getReasonEmoji(reason: RenvoiReason): string {
  return REASON_OPTIONS.find((r) => r.value === reason)?.emoji ?? "📋"
}

export function getStatusOption(status: RenvoiStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0]
}
