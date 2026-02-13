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

