import type { ShopifyOrder, EnrichedOrder, ShippingThresholds } from "./types"

/**
 * Get the effective ship date considering:
 * - Orders placed after 16:30 ship the next business day
 * - Weekend days roll to Monday
 */
function getEffectiveShipDate(date: Date): Date {
  const d = new Date(date)
  const hours = d.getHours()
  const minutes = d.getMinutes()

  // After 16:30 → ships next day
  if (hours > 16 || (hours === 16 && minutes >= 30)) {
    d.setDate(d.getDate() + 1)
  }

  d.setHours(0, 0, 0, 0)

  // If landed on Saturday → Monday
  if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  // If landed on Sunday → Monday
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)

  return d
}

/**
 * Calculate business days (Monday-Friday) between two dates.
 * Does not count holidays.
 */
export function calculateBusinessDays(from: Date, to: Date): number {
  let count = 0
  const current = new Date(from)
  current.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)

  while (current < end) {
    current.setDate(current.getDate() + 1)
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count++
    }
  }

  return count
}

/**
 * Determine alert level for an order based on shipment status and elapsed business days.
 */
export function getAlertLevel(
  shipmentStatus: string | null,
  businessDays: number,
  countryCode: string,
  thresholds: ShippingThresholds
): "delayed" | "in_transit" | "delivered" {
  // Delivered or ready for pickup
  if (
    shipmentStatus === "DELIVERED" ||
    shipmentStatus === "READY_FOR_PICKUP"
  ) {
    return "delivered"
  }

  // Check delay threshold based on country
  const threshold =
    countryCode === "BE" ? thresholds.be : thresholds.fr

  if (businessDays > threshold) {
    return "delayed"
  }

  return "in_transit"
}

/**
 * Transform raw Shopify orders into enriched orders with alert levels.
 */
export function enrichOrders(
  orders: ShopifyOrder[],
  thresholds: ShippingThresholds
): EnrichedOrder[] {
  const now = new Date()

  return orders.map((order) => {
    const fulfillment = order.fulfillments[0]
    const shippedAt = fulfillment?.createdAt ?? new Date().toISOString()
    const effectiveShipDate = getEffectiveShipDate(new Date(shippedAt))
    const businessDays = calculateBusinessDays(effectiveShipDate, now)
    const shipmentStatus = fulfillment?.shipmentStatus ?? null
    const countryCode = order.shippingAddress.countryCode

    const alertLevel = getAlertLevel(
      shipmentStatus,
      businessDays,
      countryCode,
      thresholds
    )

    return {
      id: order.id,
      orderName: order.name,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      customerEmail: order.customer.email,
      countryCode,
      totalPrice: order.totalPrice,
      shippedAt,
      trackingNumber: fulfillment?.trackingNumber ?? null,
      trackingUrl: fulfillment?.trackingUrl ?? null,
      shipmentStatus,
      businessDaysElapsed: businessDays,
      isDelayed: alertLevel === "delayed",
      alertLevel,
    }
  })
}

/**
 * Format date to French format DD/MM/YYYY
 */
export function formatDateFR(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Get human-readable shipment status in French
 */
export function getShipmentStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    CONFIRMED: "Confirmé",
    IN_TRANSIT: "En transit",
    OUT_FOR_DELIVERY: "En cours de livraison",
    ATTEMPTED_DELIVERY: "Tentative de livraison",
    DELIVERED: "Livré",
    FAILURE: "Échec",
    LABEL_PRINTED: "Étiquette imprimée",
    LABEL_PURCHASED: "Étiquette achetée",
    READY_FOR_PICKUP: "Prêt pour retrait",
  }
  return status ? (labels[status] ?? status) : "Inconnu"
}

/**
 * Get country flag emoji
 */
export function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    FR: "🇫🇷",
    BE: "🇧🇪",
    LU: "🇱🇺",
    CH: "🇨🇭",
    DE: "🇩🇪",
    NL: "🇳🇱",
  }
  return flags[countryCode] ?? "🌍"
}
