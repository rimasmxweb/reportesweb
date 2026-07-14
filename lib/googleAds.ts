// Cliente directo a la API REST de Google Ads (sin base de datos intermedia).
// Se autentica con refresh token + service credentials y consulta GAQL en vivo.

const API_VERSION = 'v24'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export type GoogleAdsRow = {
  campaignId: string
  campaignName: string
  status: string
  currency: string
  date: string
  impressions: number
  clicks: number
  cost: number
  cpm: number
  ctr: number
  videoViews: number
  p25: number | null
  p50: number | null
  p75: number | null
  p100: number | null
  conversions: number
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`No se pudo obtener el access token de Google (${res.status}): ${await res.text()}`)
  }
  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

const GAQL = (dateFrom: string, dateTo: string) => `
  SELECT
    campaign.id, campaign.name, campaign.status,
    customer.currency_code,
    segments.date,
    metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.average_cpm, metrics.ctr,
    metrics.video_trueview_views,
    metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
    metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate,
    metrics.conversions
  FROM campaign
  WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
    AND metrics.impressions > 0
`.replace(/\s+/g, ' ').trim()

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function searchCustomer(customerId: string, dateFrom: string, dateTo: string): Promise<GoogleAdsRow[]> {
  const token = await getAccessToken()
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '').trim()

  const rows: GoogleAdsRow[] = []
  let pageToken: string | undefined

  do {
    const res = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          'Content-Type': 'application/json',
          ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
        },
        body: JSON.stringify({ query: GAQL(dateFrom, dateTo), pageToken }),
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Google Ads API error (cuenta ${customerId}, ${res.status}): ${body.slice(0, 500)}`)
    }

    const data = await res.json()
    for (const r of data.results ?? []) {
      const m = r.metrics ?? {}
      rows.push({
        campaignId: String(r.campaign?.id ?? ''),
        campaignName: r.campaign?.name ?? '',
        status: r.campaign?.status ?? 'UNKNOWN',
        currency: r.customer?.currencyCode ?? 'USD',
        date: r.segments?.date ?? '',
        impressions: num(m.impressions),
        clicks: num(m.clicks),
        cost: num(m.costMicros) / 1_000_000,
        cpm: num(m.averageCpm) / 1_000_000,
        ctr: num(m.ctr),
        videoViews: num(m.videoTrueviewViews),
        p25: m.videoQuartileP25Rate ?? null,
        p50: m.videoQuartileP50Rate ?? null,
        p75: m.videoQuartileP75Rate ?? null,
        p100: m.videoQuartileP100Rate ?? null,
        conversions: num(m.conversions),
      })
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return rows
}

function getCustomerIds(): string[] {
  return (process.env.GOOGLE_ADS_CUSTOMER_IDS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/-/g, ''))
    .filter(Boolean)
}

// Cache en memoria de proceso (vida corta, útil dentro de una misma instancia serverless caliente).
const cache = new Map<string, { data: GoogleAdsRow[]; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function fetchAllCampaignRows(dateFrom: string, dateTo: string): Promise<GoogleAdsRow[]> {
  const key = `${dateFrom}:${dateTo}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.data

  const customerIds = getCustomerIds()
  const results = await Promise.all(
    customerIds.map((id) =>
      searchCustomer(id, dateFrom, dateTo).catch((err) => {
        console.error(`[googleAds] fallo en cuenta ${id}:`, err.message)
        return [] as GoogleAdsRow[]
      })
    )
  )
  const rows = results.flat()
  cache.set(key, { data: rows, expiresAt: Date.now() + CACHE_TTL_MS })
  return rows
}

// 'ENABLED' es el único estado de Google Ads que significa "entregando ahora mismo".
export function isGoogleStatusActive(status: string | undefined): boolean {
  return status === 'ENABLED'
}
