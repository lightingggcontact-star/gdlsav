import type { LaPosteTracking, LaPosteShipment } from "./types"

const API_KEY = process.env.LAPOSTE_API_KEY
const BASE_URL = "https://api.laposte.fr/suivi/v2/idships"

// Event codes that indicate a problem
const PROBLEM_CODES = new Set(["PB1", "ND1", "DO3", "DI3"])
// Event codes that indicate returned to sender
const RETURN_CODES = new Set(["RE1", "DI2"])
// Event codes that indicate delivered
const DELIVERED_CODES = new Set(["DI0", "DI1"])

function deriveStatusSummary(
  shipment: LaPosteShipment
): LaPosteTracking["statusSummary"] {
  if (!shipment.event?.length) return "unknown"

  // Check most recent event first
  const latestCode = shipment.event[0]?.code
  if (DELIVERED_CODES.has(latestCode)) return "delivered"
  if (RETURN_CODES.has(latestCode)) return "returned"
  if (PROBLEM_CODES.has(latestCode)) return "problem"

  // Also check if isFinal and deliveryDate exists
  if (shipment.isFinal && shipment.deliveryDate) return "delivered"

  // Check all events for problems/returns (not just the latest)
  for (const evt of shipment.event) {
    if (RETURN_CODES.has(evt.code)) return "returned"
    if (PROBLEM_CODES.has(evt.code)) return "problem"
  }

  return "in_transit"
}

/**
 * Fetch tracking info for one or more tracking numbers from La Poste API.
 * The API supports up to 10 tracking numbers per request (comma-separated).
 */
export async function fetchTracking(
  trackingNumbers: string[]
): Promise<LaPosteTracking[]> {
  if (!API_KEY) {
    throw new Error("La Poste API key not configured (LAPOSTE_API_KEY)")
  }

  if (trackingNumbers.length === 0) return []

  // La Poste API supports max 10 per request
  const batches: string[][] = []
  for (let i = 0; i < trackingNumbers.length; i += 10) {
    batches.push(trackingNumbers.slice(i, i + 10))
  }

  const results: LaPosteTracking[] = []

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]
    const ids = batch.join(",")

    // Rate limiting: wait 100ms between batches (10 req/s max)
    if (batchIdx > 0) {
      await new Promise((r) => setTimeout(r, 150))
    }

    try {
      const res = await fetch(`${BASE_URL}/${ids}?lang=fr_FR`, {
        headers: {
          Accept: "application/json",
          "X-Okapi-Key": API_KEY,
        },
      })

      if (!res.ok) {
        const errorMsg =
          res.status === 403
            ? "API La Poste non activée — abonnez l'app à Suivi v2 sur developer.laposte.fr"
            : res.status === 401
              ? "Clé API La Poste invalide"
              : `Erreur API La Poste (${res.status})`

        // If the whole batch fails, return error for each
        for (const num of batch) {
          results.push({
            trackingNumber: num,
            returnCode: res.status,
            error: errorMsg,
            lastEventLabel: errorMsg,
            lastEventCode: "",
            lastEventDate: "",
            statusSummary: "unknown",
          })
        }
        continue
      }

      const data = await res.json()

      // Single tracking number returns a single shipment object
      // Multiple returns could be 207 with multiple results
      if (batch.length === 1) {
        const tracking = parseSingleResponse(batch[0], data)
        results.push(tracking)
      } else {
        // For multi-tracking, the response code 207 means mixed results
        // Each shipment is in data.shipment (could be array or single)
        if (data.returnCode === 207 && Array.isArray(data.shipment)) {
          for (let i = 0; i < batch.length; i++) {
            const shipmentData = data.shipment[i]
            if (shipmentData) {
              results.push(parseShipment(batch[i], shipmentData))
            } else {
              results.push({
                trackingNumber: batch[i],
                returnCode: 404,
                error: "Suivi non trouvé",
                lastEventLabel: "Non trouvé",
                lastEventCode: "",
                lastEventDate: "",
                statusSummary: "unknown",
              })
            }
          }
        } else {
          // Single result for the batch
          const tracking = parseSingleResponse(batch[0], data)
          results.push(tracking)
          // Mark others as not found if only one returned
          for (let i = 1; i < batch.length; i++) {
            results.push({
              trackingNumber: batch[i],
              returnCode: 404,
              error: "Suivi non trouvé",
              lastEventLabel: "Non trouvé",
              lastEventCode: "",
              lastEventDate: "",
              statusSummary: "unknown",
            })
          }
        }
      }
    } catch (err) {
      for (const num of batch) {
        results.push({
          trackingNumber: num,
          returnCode: 500,
          error: err instanceof Error ? err.message : "Erreur réseau",
          lastEventLabel: "Erreur réseau",
          lastEventCode: "",
          lastEventDate: "",
          statusSummary: "unknown",
        })
      }
    }
  }

  return results
}

function parseSingleResponse(
  trackingNumber: string,
  data: { returnCode: number; shipment?: LaPosteShipment; returnMessage?: string }
): LaPosteTracking {
  if (data.returnCode === 200 && data.shipment) {
    return parseShipment(trackingNumber, data.shipment)
  }

  return {
    trackingNumber,
    returnCode: data.returnCode,
    error: data.returnMessage ?? "Suivi non disponible",
    lastEventLabel: data.returnMessage ?? "Non disponible",
    lastEventCode: "",
    lastEventDate: "",
    statusSummary: "unknown",
  }
}

function parseShipment(
  trackingNumber: string,
  shipment: LaPosteShipment
): LaPosteTracking {
  const latestEvent = shipment.event?.[0]

  return {
    trackingNumber,
    returnCode: 200,
    shipment,
    lastEventLabel: latestEvent?.label ?? "Aucun événement",
    lastEventCode: latestEvent?.code ?? "",
    lastEventDate: latestEvent?.date ?? "",
    statusSummary: deriveStatusSummary(shipment),
  }
}

/**
 * Test La Poste API connection
 */
export async function testConnection(): Promise<boolean> {
  if (!API_KEY) return false

  try {
    // Use a known sandbox number for testing
    const res = await fetch(`${BASE_URL}/LU680211095FR?lang=fr_FR`, {
      headers: {
        Accept: "application/json",
        "X-Okapi-Key": API_KEY,
      },
    })
    return res.ok
  } catch {
    return false
  }
}
