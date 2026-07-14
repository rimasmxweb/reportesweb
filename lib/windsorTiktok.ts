// Cliente directo a Windsor AI, usado ÚNICAMENTE para TikTok (Google Ads y
// Meta ya tienen APIs directas propias — ver lib/googleAds.ts y lib/meta.ts).
// Windsor sí expone campaign_status real para TikTok, así que no dependemos
// de la heurística de "actividad reciente" para saber si está activa.

const BASE = 'https://connectors.windsor.ai/all'

export type TikTokRow = {
  campaignId: string
  campaignName: string
  status: string // 'active' | 'ended' — ya normalizado
  currency: string
  date: string
  impressions: number
  clicks: number
  cost: number
  cpm: number
  cpc: number
  ctr: number
  reach: number
  thruplay: number // = play_duration_2s: "Video Views" estándar de TikTok Ads Manager (reproducción ≥2s)
  focusedView6s: number
  focusedView15s: number
  playFirstQuartile: number
  playMidpoint: number
  playThirdQuartile: number
  playOver: number
  organicVideoViews: number
  paidEngagedView: number
  paidEngagedView15s: number
  engagements: number
  engagementRate: number
  resultCount: number
  costPerResult: number | null
}

// `video_views` no es un campo real de este conector — Windsor lo acepta sin
// error pero siempre regresa null (verificado con la API real). Las métricas
// de "views" de TikTok viven bajo estos otros nombres.
const FIELDS = [
  'date', 'campaign', 'campaign_id', 'campaign_status', 'currency',
  'clicks', 'spend', 'impressions', 'ctr', 'cpm', 'cpc', 'reach',
  'play_duration_2s', 'play_duration_6s', 'focused_view_6s', 'focused_view_15s',
  'play_first_quartile', 'play_midpoint', 'play_third_quartile', 'play_over',
  'organic_video_views', 'paid_engaged_view', 'paid_engaged_view_15s',
  'engagements', 'engagement_rate',
  'likes', 'shares', 'comments', 'follows', 'conversions', 'results',
].join(',')

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Windsor no tiene un evento de conversión configurado en la mayoría de estas
// campañas (son de reach/views/engagement, no de tráfico a sitio). Cascada:
// conversión real → "resultado" nativo de TikTok → engagement total (una señal
// de "¿le importó a la gente?" siempre disponible, en vez de puros ceros).
function extractResult(r: Record<string, unknown>, cost: number): { count: number; costPer: number | null } {
  const conversions = num(r.conversions)
  if (conversions > 0) return { count: conversions, costPer: cost / conversions }

  const results = num(r.results)
  if (results > 0) return { count: results, costPer: cost / results }

  const engagement = num(r.likes) + num(r.shares) + num(r.comments) + num(r.follows)
  if (engagement > 0) return { count: engagement, costPer: cost / engagement }

  return { count: 0, costPer: null }
}

function normalizeStatus(raw: unknown): string {
  const s = String(raw ?? '').toUpperCase()
  return s.includes('ENABLE') ? 'active' : 'ended'
}

function getAccountIds(): string[] {
  return (process.env.WINDSOR_TIKTOK_ACCOUNT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const cache = new Map<string, { data: TikTokRow[]; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function fetchAllTikTokRows(dateFrom: string, dateTo: string): Promise<TikTokRow[]> {
  const apiKey = process.env.WINDSOR_API_KEY
  const accountIds = getAccountIds()
  if (!apiKey || !accountIds.length) return []

  const key = `${dateFrom}:${dateTo}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.data

  const params = new URLSearchParams({
    api_key: apiKey,
    date_from: dateFrom,
    date_to: dateTo,
    fields: FIELDS,
    select_accounts: accountIds.map((id) => `tiktok__${id}`).join(','),
  })

  let rows: TikTokRow[] = []
  try {
    const res = await fetch(`${BASE}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Windsor API error (${res.status}): ${(await res.text()).slice(0, 500)}`)
    const data = await res.json()
    if (data.error) throw new Error(`Windsor API: ${JSON.stringify(data.error).slice(0, 500)}`)

    rows = (data.data ?? []).map((r: Record<string, unknown>) => {
      const cost = num(r.spend)
      const { count, costPer } = extractResult(r, cost)
      return {
        campaignId: String(r.campaign_id ?? ''),
        campaignName: String(r.campaign ?? ''),
        status: normalizeStatus(r.campaign_status),
        currency: String(r.currency ?? 'USD'),
        date: String(r.date ?? ''),
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        cost,
        cpm: num(r.cpm),
        cpc: num(r.cpc),
        ctr: num(r.ctr),
        reach: num(r.reach),
        thruplay: num(r.play_duration_2s),
        focusedView6s: num(r.focused_view_6s),
        focusedView15s: num(r.focused_view_15s),
        playFirstQuartile: num(r.play_first_quartile),
        playMidpoint: num(r.play_midpoint),
        playThirdQuartile: num(r.play_third_quartile),
        playOver: num(r.play_over),
        organicVideoViews: num(r.organic_video_views),
        paidEngagedView: num(r.paid_engaged_view),
        paidEngagedView15s: num(r.paid_engaged_view_15s),
        engagements: num(r.engagements),
        engagementRate: num(r.engagement_rate),
        resultCount: count,
        costPerResult: costPer,
      }
    }).filter((r: TikTokRow) => r.campaignId && r.date)
  } catch (err) {
    console.error('[windsorTiktok] fallo:', err instanceof Error ? err.message : err)
    return cache.get(key)?.data ?? []
  }

  cache.set(key, { data: rows, expiresAt: Date.now() + CACHE_TTL_MS })
  return rows
}
