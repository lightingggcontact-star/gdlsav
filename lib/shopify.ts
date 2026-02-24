import type { ShopifyOrder } from "./types"

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_API_KEY
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_API_SECRET

const GRAPHQL_URL = `https://${SHOPIFY_DOMAIN}/admin/api/2025-01/graphql.json`
const TOKEN_URL = `https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`

// Cache the access token in memory (valid 24h, we refresh at 23h)
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 1h margin)
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  if (!SHOPIFY_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error("Shopify credentials not configured (SHOPIFY_STORE_DOMAIN, SHOPIFY_API_KEY, SHOPIFY_API_SECRET)")
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify token exchange failed: ${res.status} ${res.statusText} — ${text}`)
  }

  const data = await res.json()
  const expiresIn = data.expires_in ?? 86399 // default 24h

  cachedToken = {
    token: data.access_token,
    // Refresh 1h before expiry
    expiresAt: Date.now() + (expiresIn - 3600) * 1000,
  }

  return cachedToken.token
}

interface GraphQLResponse {
  data?: {
    orders: {
      edges: {
        node: {
          id: string
          name: string
          totalPriceSet: {
            shopMoney: {
              amount: string
            }
          }
          customer: {
            firstName: string
            lastName: string
            email: string
          } | null
          shippingAddress: {
            countryCode: string
          } | null
          fulfillments: {
            createdAt: string
            trackingInfo: {
              number: string | null
              url: string | null
            }[]
            displayStatus: string | null
          }[]
        }
        cursor: string
      }[]
      pageInfo: {
        hasNextPage: boolean
      }
    }
  }
  errors?: { message: string }[]
}

const ORDERS_QUERY = `
  query FulfilledOrders($query: String!, $cursor: String) {
    orders(first: 250, query: $query, after: $cursor) {
      edges {
        node {
          id
          name
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          customer {
            firstName
            lastName
            email
          }
          shippingAddress {
            countryCode
          }
          fulfillments {
            createdAt
            trackingInfo {
              number
              url
            }
            displayStatus
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`

async function shopifyGraphQL(
  query: string,
  variables: Record<string, unknown>
): Promise<GraphQLResponse> {
  const accessToken = await getAccessToken()

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    // If 401, maybe token expired — clear cache and retry once
    if (res.status === 401 && cachedToken) {
      cachedToken = null
      const freshToken = await getAccessToken()
      const retryRes = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": freshToken,
        },
        body: JSON.stringify({ query, variables }),
      })
      if (!retryRes.ok) {
        throw new Error(`Shopify API error: ${retryRes.status} ${retryRes.statusText}`)
      }
      return retryRes.json()
    }
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function fetchFulfilledOrders(
  options: { daysBack?: number; startDate?: string; endDate?: string } = {}
): Promise<ShopifyOrder[]> {
  const { daysBack = 7, startDate, endDate } = options

  let queryFilter: string
  if (startDate && endDate) {
    queryFilter = `fulfillment_status:shipped created_at:>=${startDate} created_at:<=${endDate}`
  } else if (startDate) {
    queryFilter = `fulfillment_status:shipped created_at:>=${startDate}`
  } else {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - daysBack)
    const sinceDateStr = sinceDate.toISOString().split("T")[0]
    queryFilter = `fulfillment_status:shipped created_at:>=${sinceDateStr}`
  }

  const allOrders: ShopifyOrder[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const response = await shopifyGraphQL(ORDERS_QUERY, {
      query: queryFilter,
      cursor,
    })

    if (response.errors?.length) {
      throw new Error(
        `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
      )
    }

    const edges = response.data?.orders.edges ?? []

    for (const edge of edges) {
      const node = edge.node
      const fulfillment = node.fulfillments[0]
      const trackingInfo = fulfillment?.trackingInfo?.[0]

      allOrders.push({
        id: node.id,
        name: node.name,
        customer: {
          firstName: node.customer?.firstName ?? "",
          lastName: node.customer?.lastName ?? "",
          email: node.customer?.email ?? "",
        },
        shippingAddress: {
          countryCode: node.shippingAddress?.countryCode ?? "FR",
        },
        totalPrice: node.totalPriceSet.shopMoney.amount,
        fulfillments: node.fulfillments.map((f) => ({
          createdAt: f.createdAt,
          trackingNumber: f.trackingInfo?.[0]?.number ?? null,
          trackingUrl: f.trackingInfo?.[0]?.url ?? null,
          shipmentStatus: f.displayStatus,
        })),
      })
    }

    hasNextPage = response.data?.orders.pageInfo.hasNextPage ?? false
    if (edges.length > 0) {
      cursor = edges[edges.length - 1].cursor
    }
  }

  return allOrders
}

// ─── Fetch orders by customer email ───

const ORDERS_BY_EMAIL_QUERY = `
  query OrdersByEmail($query: String!) {
    orders(first: 10, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          customer {
            firstName
            lastName
            email
            numberOfOrders
            amountSpent {
              amount
              currencyCode
            }
          }
          shippingAddress {
            countryCode
          }
          fulfillments {
            createdAt
            trackingInfo {
              number
              url
            }
            displayStatus
          }
          metafield(namespace: "custom", key: "photo_commande") {
            value
            type
            reference {
              ... on MediaImage {
                image {
                  url
                }
              }
              ... on GenericFile {
                url
              }
            }
          }
        }
      }
    }
  }
`

export interface CustomerOrderInfo {
  totalOrders: number
  totalSpent: string | null
  orders: {
    id: string
    name: string
    createdAt: string
    totalPrice: string
    currency: string
    financialStatus: string | null
    fulfillmentStatus: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    shipmentStatus: string | null
    countryCode: string
    photoUrl: string | null
  }[]
}

export async function fetchOrdersByEmail(email: string): Promise<CustomerOrderInfo> {
  const queryFilter = `email:${email}`

  const response = await shopifyGraphQL(ORDERS_BY_EMAIL_QUERY, {
    query: queryFilter,
  })

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.orders?.edges ?? []

  const orders = edges.map((edge: any) => {
    const node = edge.node
    const fulfillment = node.fulfillments?.[0]
    const trackingInfo = fulfillment?.trackingInfo?.[0]

    // Extract photo from metafield reference
    const metafield = node.metafield
    const photoUrl = metafield?.reference?.image?.url ?? metafield?.reference?.url ?? null

    return {
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      totalPrice: node.totalPriceSet.shopMoney.amount,
      currency: node.totalPriceSet.shopMoney.currencyCode,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      trackingNumber: trackingInfo?.number ?? null,
      trackingUrl: trackingInfo?.url ?? null,
      shipmentStatus: fulfillment?.displayStatus ?? null,
      countryCode: node.shippingAddress?.countryCode ?? "FR",
      photoUrl,
    }
  })

  const customer = edges[0]?.node?.customer
  const totalOrders = customer?.numberOfOrders
    ? parseInt(customer.numberOfOrders, 10)
    : orders.length
  const totalSpent = customer?.amountSpent?.amount ?? null

  return { totalOrders, totalSpent, orders }
}

// ─── Search orders by name, email, or customer name ───

const SEARCH_ORDERS_QUERY = `
  query SearchOrders($query: String!) {
    orders(first: 10, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          displayFulfillmentStatus
          customer {
            firstName
            lastName
            email
          }
        }
      }
    }
  }
`

export interface SearchOrderResult {
  id: string
  name: string
  createdAt: string
  totalPrice: string
  fulfillmentStatus: string | null
  customerName: string
  customerEmail: string
}

export async function searchOrders(query: string): Promise<SearchOrderResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  let shopifyQuery: string
  if (trimmed.startsWith("#") || /^GDL-?\d+$/i.test(trimmed)) {
    shopifyQuery = `name:${trimmed}`
  } else if (trimmed.includes("@")) {
    shopifyQuery = `email:${trimmed}`
  } else {
    shopifyQuery = trimmed
  }

  const response = await shopifyGraphQL(SEARCH_ORDERS_QUERY, {
    query: shopifyQuery,
  })

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.orders?.edges ?? []

  return edges.map((edge: any) => {
    const node = edge.node
    return {
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      totalPrice: node.totalPriceSet.shopMoney.amount,
      fulfillmentStatus: node.displayFulfillmentStatus,
      customerName: [node.customer?.firstName, node.customer?.lastName].filter(Boolean).join(" "),
      customerEmail: node.customer?.email ?? "",
    }
  })
}

export async function testConnection(): Promise<boolean> {
  try {
    const response = await shopifyGraphQL(
      `{ shop { name } }`,
      {}
    )
    return !response.errors?.length
  } catch {
    return false
  }
}

// ─── Fetch customer + orders by phone number ───

const CUSTOMER_BY_PHONE_QUERY = `
  query CustomerByPhone($query: String!) {
    customers(first: 3, query: $query) {
      edges {
        node {
          id
          firstName
          lastName
          email
          phone
          numberOfOrders
          amountSpent {
            amount
            currencyCode
          }
          createdAt
          defaultAddress {
            city
            countryCode
          }
          tags
          orders(first: 10, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                displayFinancialStatus
                displayFulfillmentStatus
                fulfillments {
                  createdAt
                  trackingInfo {
                    number
                    url
                  }
                  displayStatus
                }
              }
            }
          }
        }
      }
    }
  }
`

export interface PhoneCustomerInfo {
  found: boolean
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string
    numberOfOrders: number
    totalSpent: string
    currency: string
    city: string | null
    countryCode: string
    tags: string[]
    createdAt: string
  } | null
  orders: {
    id: string
    name: string
    createdAt: string
    totalPrice: string
    currency: string
    financialStatus: string | null
    fulfillmentStatus: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    shipmentStatus: string | null
  }[]
}

export async function fetchCustomerByPhone(phone: string): Promise<PhoneCustomerInfo> {
  const queryFilter = `phone:${phone}`

  const response = await shopifyGraphQL(CUSTOMER_BY_PHONE_QUERY, {
    query: queryFilter,
  })

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.customers?.edges ?? []

  if (edges.length === 0) {
    return { found: false, customer: null, orders: [] }
  }

  const node = edges[0].node

  const customer = {
    id: node.id,
    firstName: node.firstName ?? "",
    lastName: node.lastName ?? "",
    email: node.email ?? "",
    phone: node.phone ?? phone,
    numberOfOrders: node.numberOfOrders ? parseInt(node.numberOfOrders, 10) : 0,
    totalSpent: node.amountSpent?.amount ?? "0",
    currency: node.amountSpent?.currencyCode ?? "EUR",
    city: node.defaultAddress?.city ?? null,
    countryCode: node.defaultAddress?.countryCode ?? "FR",
    tags: node.tags ?? [],
    createdAt: node.createdAt ?? "",
  }

  const orders = (node.orders?.edges ?? []).map((orderEdge: any) => {
    const o = orderEdge.node
    const fulfillment = o.fulfillments?.[0]
    const trackingInfo = fulfillment?.trackingInfo?.[0]
    return {
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      totalPrice: o.totalPriceSet.shopMoney.amount,
      currency: o.totalPriceSet.shopMoney.currencyCode,
      financialStatus: o.displayFinancialStatus,
      fulfillmentStatus: o.displayFulfillmentStatus,
      trackingNumber: trackingInfo?.number ?? null,
      trackingUrl: trackingInfo?.url ?? null,
      shipmentStatus: fulfillment?.displayStatus ?? null,
    }
  })

  return { found: true, customer, orders }
}

// ─── Batch lookup customers by phone (single GraphQL call with aliases) ───

export interface PhoneCustomerBasic {
  firstName: string
  lastName: string
  email: string
  numberOfOrders: number
  totalSpent: string
}

export async function fetchCustomersByPhones(
  phones: string[]
): Promise<Record<string, PhoneCustomerBasic | null>> {
  if (phones.length === 0) return {}

  // Build a single GraphQL query with aliases: p0, p1, p2, ...
  // Max ~30 aliases per query to stay safe
  const batch = phones.slice(0, 30)

  const fragments = batch.map((phone, i) => {
    const escaped = phone.replace(/"/g, '\\"')
    return `p${i}: customers(first: 1, query: "phone:${escaped}") {
      edges {
        node {
          firstName
          lastName
          email
          numberOfOrders
          amountSpent { amount }
        }
      }
    }`
  })

  const query = `query BatchCustomers { ${fragments.join("\n")} }`

  const response = await shopifyGraphQL(query, {})

  const result: Record<string, PhoneCustomerBasic | null> = {}

  for (let i = 0; i < batch.length; i++) {
    const data = (response.data as any)?.[`p${i}`]
    const node = data?.edges?.[0]?.node
    if (node && (node.firstName || node.lastName)) {
      result[batch[i]] = {
        firstName: node.firstName ?? "",
        lastName: node.lastName ?? "",
        email: node.email ?? "",
        numberOfOrders: node.numberOfOrders ? parseInt(node.numberOfOrders, 10) : 0,
        totalSpent: node.amountSpent?.amount ?? "0",
      }
    } else {
      result[batch[i]] = null
    }
  }

  return result
}

// ─── Search products by title ───

const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!) {
    products(first: 20, query: $query) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
          }
          status
        }
      }
    }
  }
`

export interface ShopifyProductResult {
  id: string
  numericId: string
  title: string
  handle: string
  imageUrl: string | null
}

export async function searchProducts(query: string): Promise<ShopifyProductResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const shopifyQuery = `${trimmed} status:active`

  const response = await shopifyGraphQL(SEARCH_PRODUCTS_QUERY, {
    query: shopifyQuery,
  })

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.products?.edges ?? []

  return edges.map((edge: any) => {
    const node = edge.node
    const gid = node.id as string
    const numericId = gid.split("/").pop() ?? gid
    return {
      id: gid,
      numericId,
      title: node.title,
      handle: node.handle,
      imageUrl: node.featuredImage?.url ?? null,
    }
  })
}

// ─── Collections ───

const LIST_COLLECTIONS_QUERY = `
  query ListCollections {
    collections(first: 100, sortKey: TITLE) {
      edges {
        node {
          id
          title
          handle
          productsCount { count }
        }
      }
    }
  }
`

export interface ShopifyCollection {
  id: string
  numericId: string
  title: string
  handle: string
  productsCount: number
}

export async function listCollections(): Promise<ShopifyCollection[]> {
  const response = await shopifyGraphQL(LIST_COLLECTIONS_QUERY, {})

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.collections?.edges ?? []

  return edges.map((edge: any) => {
    const node = edge.node
    const gid = node.id as string
    const numericId = gid.split("/").pop() ?? gid
    return {
      id: gid,
      numericId,
      title: node.title,
      handle: node.handle,
      productsCount: node.productsCount?.count ?? 0,
    }
  })
}

const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts($id: ID!) {
    collection(id: $id) {
      products(first: 250) {
        edges {
          node {
            id
            title
            handle
            featuredImage { url }
          }
        }
      }
    }
  }
`

export async function getCollectionProducts(collectionGid: string): Promise<ShopifyProductResult[]> {
  const response = await shopifyGraphQL(COLLECTION_PRODUCTS_QUERY, { id: collectionGid })

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.collection?.products?.edges ?? []

  return edges.map((edge: any) => {
    const node = edge.node
    const gid = node.id as string
    const numericId = gid.split("/").pop() ?? gid
    return {
      id: gid,
      numericId,
      title: node.title,
      handle: node.handle,
      imageUrl: node.featuredImage?.url ?? null,
    }
  })
}

const ALL_PRODUCTS_QUERY = `
  query AllProducts {
    products(first: 250, query: "status:active") {
      edges {
        node {
          id
          title
          handle
          featuredImage { url }
        }
      }
    }
  }
`

export async function getAllProducts(): Promise<ShopifyProductResult[]> {
  const response = await shopifyGraphQL(ALL_PRODUCTS_QUERY, {})

  if (response.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`
    )
  }

  const edges = (response.data as any)?.products?.edges ?? []

  return edges.map((edge: any) => {
    const node = edge.node
    const gid = node.id as string
    const numericId = gid.split("/").pop() ?? gid
    return {
      id: gid,
      numericId,
      title: node.title,
      handle: node.handle,
      imageUrl: node.featuredImage?.url ?? null,
    }
  })
}
