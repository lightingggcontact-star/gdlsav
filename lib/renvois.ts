import type { SupabaseClient } from "@supabase/supabase-js"
import type { Renvoi, RenvoiReason, RenvoiStatus, ShippingStatus } from "./types"

// Map old statuses from DB to new ones
function normalizeStatus(raw: string): RenvoiStatus {
  if (raw === "a_renvoyer") return "a_renvoyer"
  if (raw === "expedie") return "expedie"
  if (raw === "livre") return "livre"
  // Legacy mappings
  if (raw === "en_cours") return "a_renvoyer"
  if (raw === "annule") return "a_renvoyer"
  return "a_renvoyer"
}

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
    status: normalizeStatus(row.status),
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
    note?: string
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
      status: "a_renvoyer",
      tracking_number: "",
      note: input.note ?? "",
      renvoi_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single()

  if (error || !data) throw new Error("Impossible de creer le renvoi")
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

export async function markColisRevenu(supabase: SupabaseClient, id: string, revenu: boolean) {
  await supabase.from("renvois").update({ colis_revenu: revenu }).eq("id", id)
}

export async function deleteRenvoi(supabase: SupabaseClient, id: string) {
  await supabase.from("renvois").delete().eq("id", id)
}

/**
 * Derive the correct renvoi status from La Poste tracking.
 * Returns null if no status change is needed.
 */
export function deriveRenvoiStatusFromTracking(
  currentStatus: RenvoiStatus,
  lpStatus: ShippingStatus | "unknown"
): RenvoiStatus | null {
  // Already livre → no change
  if (currentStatus === "livre") return null

  // La Poste says delivered or pickup ready → livre
  if (lpStatus === "delivered" || lpStatus === "pickup_ready") {
    return "livre"
  }

  // La Poste says in transit / out for delivery → expedie
  if (lpStatus === "in_transit" || lpStatus === "out_for_delivery" || lpStatus === "delayed") {
    return currentStatus === "a_renvoyer" ? "expedie" : null
  }

  return null
}

export const REASON_OPTIONS: { value: RenvoiReason; label: string; emoji: string }[] = [
  { value: "colis_perdu", label: "Colis perdu", emoji: "📦" },
  { value: "colis_endommage", label: "Colis endommage", emoji: "💔" },
  { value: "erreur_preparation", label: "Erreur preparation", emoji: "⚠️" },
  { value: "retour_client", label: "Retour client", emoji: "↩️" },
  { value: "autre", label: "Autre", emoji: "📋" },
]

export const STATUS_OPTIONS: { value: RenvoiStatus; label: string; bg: string; text: string }[] = [
  { value: "a_renvoyer", label: "A renvoyer", bg: "bg-amber-500/15", text: "text-amber-600" },
  { value: "expedie", label: "Expedie", bg: "bg-blue-500/15", text: "text-blue-600" },
  { value: "livre", label: "Livre", bg: "bg-emerald-500/15", text: "text-emerald-600" },
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
