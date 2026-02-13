import { NextResponse, type NextRequest } from "next/server"
import { getGorgiasConfig, gorgiasFetch } from "@/lib/gorgias"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] })
  }

  try {
    const { baseUrl, headers } = getGorgiasConfig()
    const allTickets: any[] = []
    const seenIds = new Set<number>()

    const addTickets = (tickets: any[]) => {
      for (const t of tickets) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id)
          allTickets.push(t)
        }
      }
    }

    // Fetch recent customers and filter locally by name/email
    const customerUrl = new URL(`${baseUrl}/customers`)
    customerUrl.searchParams.set("limit", "100")
    customerUrl.searchParams.set("order_by", "updated_datetime:desc")

    const customerRes = await gorgiasFetch(customerUrl.toString(), { headers })
    if (!customerRes.ok) {
      return NextResponse.json({ data: [] })
    }

    const customerData = await customerRes.json()
    const query = q.toLowerCase()
    const matchingCustomers = (customerData.data || []).filter((c: any) => {
      const fullName = [c.name, c.firstname, c.lastname].filter(Boolean).join(" ").toLowerCase()
      const email = (c.email || "").toLowerCase()
      return fullName.includes(query) || email.includes(query)
    })

    // Fetch tickets for up to 5 matching customers
    for (const customer of matchingCustomers.slice(0, 5)) {
      const ticketUrl = new URL(`${baseUrl}/tickets`)
      ticketUrl.searchParams.set("customer_id", String(customer.id))
      ticketUrl.searchParams.set("limit", "30")
      ticketUrl.searchParams.set("order_by", "updated_datetime:desc")

      const ticketRes = await gorgiasFetch(ticketUrl.toString(), { headers })
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json()
        addTickets(ticketData.data || [])
      }
    }

    return NextResponse.json({ data: allTickets })
  } catch (error) {
    console.error("Gorgias search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur recherche" },
      { status: 500 }
    )
  }
}
