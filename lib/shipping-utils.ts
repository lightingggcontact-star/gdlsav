import type { ShopifyOrder, EnrichedOrder, ShippingThresholds, ShippingStatus } from "./types"

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
 * Shipping status config — label, colors, badge classes for each ShippingStatus.
 */
export interface ShippingStatusConfig {
  label: string
  badgeClassName: string
  iconBg: string
  iconColor: string
  valueColor: string
}

const STATUS_CONFIGS: Record<ShippingStatus, ShippingStatusConfig> = {
  delivered: {
    label: "Livré",
    badgeClassName: "bg-[#CDFED4] text-[#047B5D] border-transparent",
    iconBg: "bg-[#CDFED4]",
    iconColor: "text-[#047B5D]",
    valueColor: "text-[#047B5D]",
  },
  pickup_ready: {
    label: "Dispo retrait",
    badgeClassName: "bg-[#EAF4FF] text-[#005BD3] border-transparent",
    iconBg: "bg-[#EAF4FF]",
    iconColor: "text-[#005BD3]",
    valueColor: "text-[#005BD3]",
  },
  out_for_delivery: {
    label: "En livraison",
    badgeClassName: "bg-[#EAF4FF] text-[#005BD3] border-transparent",
    iconBg: "bg-[#EAF4FF]",
    iconColor: "text-[#005BD3]",
    valueColor: "text-[#005BD3]",
  },
  in_transit: {
    label: "En transit",
    badgeClassName: "bg-[#FFF1E3] text-[#8A6116] border-transparent",
    iconBg: "bg-[#FFF1E3]",
    iconColor: "text-[#8A6116]",
    valueColor: "text-[#8A6116]",
  },
  delayed: {
    label: "Retard",
    badgeClassName: "bg-[#FEE8EB] text-[#C70A24] border-transparent",
    iconBg: "bg-[#FEE8EB]",
    iconColor: "text-[#C70A24]",
    valueColor: "text-[#C70A24]",
  },
  problem: {
    label: "Problème",
    badgeClassName: "bg-[#FEE8EB] text-[#C70A24] border-transparent",
    iconBg: "bg-[#FEE8EB]",
    iconColor: "text-[#C70A24]",
    valueColor: "text-[#C70A24]",
  },
  returned: {
    label: "Retourné",
    badgeClassName: "bg-[#F3E8FF] text-[#7C3AED] border-transparent",
    iconBg: "bg-[#F3E8FF]",
    iconColor: "text-[#7C3AED]",
    valueColor: "text-[#7C3AED]",
  },
}

export function getShippingStatusConfig(status: ShippingStatus | "unknown"): ShippingStatusConfig {
  if (status === "unknown") {
    return {
      label: "Inconnu",
      badgeClassName: "bg-secondary text-muted-foreground border-transparent",
      iconBg: "bg-secondary",
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    }
  }
  return STATUS_CONFIGS[status]
}

/**
 * Derive shipping status from La Poste status ONLY.
 * La Poste is the single source of truth.
 * If La Poste says in_transit and business days > threshold → delayed.
 * If no La Poste data → defaults to "in_transit".
 */
export function deriveShippingStatus(
  laPosteStatus: ShippingStatus | "unknown" | undefined,
  businessDays: number,
  countryCode: string,
  thresholds: ShippingThresholds
): ShippingStatus {
  // No La Poste data → just in_transit (we wait for La Poste to tell us)
  if (!laPosteStatus || laPosteStatus === "unknown") {
    const threshold = countryCode === "BE" ? thresholds.be : thresholds.fr
    if (businessDays > threshold) return "delayed"
    return "in_transit"
  }

  // Pickup point = delivered (colis dispo en point relais = livré)
  if (laPosteStatus === "pickup_ready") return "delivered"

  // La Poste says in_transit but past threshold → delayed
  if (laPosteStatus === "in_transit") {
    const threshold = countryCode === "BE" ? thresholds.be : thresholds.fr
    if (businessDays > threshold) return "delayed"
  }

  return laPosteStatus
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

    const alertLevel = deriveShippingStatus(
      undefined,
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
      isDelayed: alertLevel === "delayed" || alertLevel === "problem" || alertLevel === "returned",
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
