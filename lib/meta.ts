// Cliente directo a la Meta Graph API (Marketing API). Sin MCP, sin base de
// datos intermedia — llamadas REST server-side, igual que lib/googleAds.ts.

const API_VERSION = 'v21.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`

export type MetaRow = {
  campaignId: string
  campaignName: string
  currency: string
  date: string
  impressions: number
  clicks: number
  cost: number
  cpm: number
  ctr: number
  reach: number
  thruplay: number
  resultCount: number
  costPerResult: number | null
}

type Action = { action_type: string; value: string }

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sumActions(actions: Action[] | undefined, predicate: (type: string) => boolean): number {
  if (!actions) return 0
  return actions.filter((a) => predicate(a.action_type)).reduce((s, a) => s + num(a.value), 0)
}

// Meta Ads Manager calcula "resultados" según el objetivo de optimización de
// cada campaña — la API cruda no expone ese campo, solo un array de `actions`
// por tipo. Las campañas de Rimas casi siempre optimizan a un evento de pixel
// personalizado (offsite_conversion.custom.*, ej. "Click Botón" → streams).
// Heurística: pixel personalizado → conversión de pixel genérica → link_click.
function extractResults(actions: Action[] | undefined, cost: number): { count: number; costPer: number | null } {
  const custom = sumActions(actions, (t) => t.startsWith('offsite_conversion.custom.'))
  if (custom > 0) return { count: custom, costPer: cost / custom }

  const pixelGeneric = sumActions(actions, (t) => t === 'offsite_conversion.fb_pixel_custom')
  if (pixelGeneric > 0) return { count: pixelGeneric, costPer: cost / pixelGeneric }

  const clicks = sumActions(actions, (t) => t === 'link_click')
  if (clicks > 0) return { count: clicks, costPer: cost / clicks }

  return { count: 0, costPer: null }
}

async function getAccountCurrency(accountId: string, token: string): Promise<string> {
  const res = await fetch(`${BASE}/act_${accountId}?fields=currency&access_token=${token}`, { cache: 'no-store' })
  if (!res.ok) return 'USD'
  const data = await res.json()
  return data.currency ?? 'USD'
}

async function fetchAccountRows(accountId: string, dateFrom: string, dateTo: string): Promise<MetaRow[]> {
  const token = process.env.META_ACCESS_TOKEN!
  const currency = await getAccountCurrency(accountId, token)

  const rows: MetaRow[] = []
  let url: string | null =
    `${BASE}/act_${accountId}/insights?` +
    new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_id,campaign_name,impressions,spend,reach,clicks,ctr,cpm,actions,video_thruplay_watched_actions',
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: '1',
      limit: '500',
      access_token: token,
    })

  while (url) {
    const res: Response = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Meta API error (cuenta ${accountId}, ${res.status}): ${body.slice(0, 500)}`)
    }
    const data = await res.json()

    for (const r of data.data ?? []) {
      const cost = num(r.spend)
      const thruplay = sumActions(r.video_thruplay_watched_actions, () => true)
      const { count, costPer } = extractResults(r.actions, cost)

      rows.push({
        campaignId: String(r.campaign_id ?? ''),
        campaignName: r.campaign_name ?? '',
        currency,
        date: r.date_start ?? '',
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        cost,
        cpm: num(r.cpm),
        ctr: num(r.ctr),
        reach: num(r.reach),
        thruplay,
        resultCount: count,
        costPerResult: costPer,
      })
    }
    url = data.paging?.next ?? null
  }

  return rows
}

function getAccountIds(): string[] {
  return (process.env.META_AD_ACCOUNT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// El estado real (activa/pausada) vive en el nodo de la campaña, no en insights.
// Una sola llamada paginada por cuenta trae el estado de TODAS sus campañas.
async function fetchAccountStatuses(accountId: string, token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let url: string | null =
    `${BASE}/act_${accountId}/campaigns?` +
    new URLSearchParams({ fields: 'id,effective_status', limit: '500', access_token: token })

  while (url) {
    const res: Response = await fetch(url, { cache: 'no-store' })
    if (!res.ok) break
    const data = await res.json()
    for (const c of data.data ?? []) map.set(String(c.id), c.effective_status ?? 'UNKNOWN')
    url = data.paging?.next ?? null
  }
  return map
}

export async function fetchAllCampaignStatuses(): Promise<Map<string, string>> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return new Map()
  const accountIds = getAccountIds()
  const results = await Promise.all(
    accountIds.map((id) =>
      fetchAccountStatuses(id, token).catch((err) => {
        console.error(`[meta] fallo consultando estado de cuenta ${id}:`, err.message)
        return new Map<string, string>()
      })
    )
  )
  const merged = new Map<string, string>()
  for (const m of results) for (const [k, v] of m) merged.set(k, v)
  return merged
}

// 'ACTIVE' es el único estado de Meta que significa "entregando ahora mismo".
export function isMetaStatusActive(effectiveStatus: string | undefined): boolean {
  return effectiveStatus === 'ACTIVE'
}

const cache = new Map<string, { data: MetaRow[]; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function fetchAllMetaRows(dateFrom: string, dateTo: string): Promise<MetaRow[]> {
  if (!process.env.META_ACCESS_TOKEN) return []

  const key = `${dateFrom}:${dateTo}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.data

  const accountIds = getAccountIds()
  const results = await Promise.all(
    accountIds.map((id) =>
      fetchAccountRows(id, dateFrom, dateTo).catch((err) => {
        console.error(`[meta] fallo en cuenta ${id}:`, err.message)
        return [] as MetaRow[]
      })
    )
  )
  const rows = results.flat()
  cache.set(key, { data: rows, expiresAt: Date.now() + CACHE_TTL_MS })
  return rows
}
