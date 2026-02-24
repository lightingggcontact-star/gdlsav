// === Shopify Types ===

export interface ShopifyOrder {
  id: string
  name: string // #GDL-XXXX
  customer: {
    firstName: string
    lastName: string
    email: string
  }
  shippingAddress: {
    countryCode: string
  }
  totalPrice: string
  fulfillments: {
    createdAt: string
    trackingNumber: string | null
    trackingUrl: string | null
    shipmentStatus: string | null
  }[]
}

export interface EnrichedOrder {
  id: string
  orderName: string
  customerName: string
  customerEmail: string
  countryCode: string
  totalPrice: string
  shippedAt: string
  trackingNumber: string | null
  trackingUrl: string | null
  shipmentStatus: string | null
  businessDaysElapsed: number
  isDelayed: boolean
  alertLevel: "delayed" | "in_transit" | "delivered"
}

// === La Poste Tracking Types ===

export interface LaPosteEvent {
  date: string
  label: string
  code: string
}

export interface LaPosteTimelineStep {
  id: number
  shortLabel: string
  longLabel: string
  date?: string
  country: string
  status: boolean
  type: number // 1=OK, 0=Aléa, -1=KO
}

export interface LaPosteShipment {
  idShip: string
  holder: number // 1=courrier nat, 2=courrier inter, 3=chronopost, 4=colissimo
  product: string
  isFinal: boolean
  entryDate?: string
  deliveryDate?: string
  event: LaPosteEvent[]
  timeline: LaPosteTimelineStep[]
  contextData?: {
    removalPoint?: { name: string; type: string }
    originCountry?: string
    arrivalCountry?: string
  }
}

export interface LaPosteTracking {
  trackingNumber: string
  returnCode: number
  shipment?: LaPosteShipment
  error?: string
  // Derived fields for easy display
  lastEventLabel: string
  lastEventCode: string
  lastEventDate: string
  statusSummary: "delivered" | "in_transit" | "problem" | "returned" | "unknown"
}

// === Settings ===

export interface ShippingThresholds {
  fr: number
  be: number
}

export const DEFAULT_THRESHOLDS: ShippingThresholds = {
  fr: 3,
  be: 5,
}

// === Segments ===

export interface Segment {
  id: string
  name: string
  color: "red" | "blue" | "green" | "purple" | "orange" | "yellow"
  createdAt: string
  orderIds: string[]
  notes: Record<string, string>
}

// === Renvois ===

export type RenvoiReason = "colis_perdu" | "colis_endommage" | "erreur_preparation" | "retour_client" | "autre"
export type RenvoiStatus = "en_cours" | "expedie" | "livre" | "annule"

export interface Renvoi {
  id: string
  createdAt: string
  shopifyOrderId: string
  orderName: string
  orderTotal: string
  customerName: string
  customerEmail: string
  reason: RenvoiReason
  status: RenvoiStatus
  trackingNumber: string
  note: string
  renvoiDate: string
  colisRevenu: boolean
}

// === Insights ===

export type InsightsPeriod = "this_week" | "last_week" | "this_month" | "last_3_months"

export interface PainPoint {
  id: number
  label: string
  description: string
  frequency: number
  severity: "high" | "medium" | "low"
  example_ticket_id: number | null
  example_quote: string
  suggested_action: string
}

export interface Objection {
  id: number
  label: string
  description: string
  frequency: number
  context: string
  example_quote: string
  recommended_response: string
}

export interface ExtremeReview {
  ticket_id: number
  customer_name: string
  quote: string
  sentiment_score: number
  topic: string
  date: string
}

export interface InsightsData {
  pain_points: PainPoint[]
  objections: Objection[]
  extreme_reviews: { positive: ExtremeReview[]; negative: ExtremeReview[] }
}

export interface InsightsCacheRow {
  id: string
  period_key: string
  period_label: string
  period_from: string
  period_to: string
  tickets_analyzed: number
  pain_points: PainPoint[]
  objections: Objection[]
  extreme_reviews: { positive: ExtremeReview[]; negative: ExtremeReview[] }
  generated_at: string
}

// === Video Stories ===

export interface StoryVideo {
  id: string
  name: string
  emoji: string
  video_url: string
  thumbnail_url: string | null
  display_order: number
  created_at: string
  stories_video_products: StoryVideoProduct[]
}

export interface StoryVideoProduct {
  id: string
  shopify_product_id: string
  shopify_product_title: string | null
  display_order: number
}

export interface StoriesSettings {
  id: string
  enabled: boolean
  circle_size: number
  border_color: string
  border_style: string
  position: string
  updated_at: string
}

