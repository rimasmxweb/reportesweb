// Lecturas del dashboard (Supabase, rápido) + matching de artistas (usado por /api/sync).
// El flujo: /api/sync escribe Google Ads → Supabase; aquí solo se lee.

import { Artist, getArtists } from './config'
import { getDb } from './db'
import { deriveProject } from './projects'

export type Campaign = {
  id: string
  name: string
  platform: string
  youtube_type: string | null
  status: string
  budget_total: number | null
  project: string
  projectKey: string
}

export type MetricRow = {
  id: string
  date: string
  impressions: number
  total_spend: number
  ctr: number | null
  cpm: number | null
  frequency: number | null
  public_views: number
  thruviews: number
  engagements: number
  subscriber_conversions: number
  follow_on_view_conversions: number
  video_retention: number | null
  view_rate: number | null
  cost_per_view: number | null
  cost_per_conversion: number | null
  reach: number
  thruplay: number
  result_count: number
  cost_per_result: number | null
  campaigns: Campaign
}

// ─────────────────────────── Match de artistas ───────────────────────────
// Exacto → sin acentos → fuzzy por token (mismo algoritmo del agente original)

function normalizeText(text: string): string {
  const stripped = text.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  return stripped.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(' ').filter((t) => t.length > 2)
}

function findLongestMatch(a: string, b: string, aLo: number, aHi: number, bLo: number, bHi: number) {
  let bestI = aLo, bestJ = bLo, bestSize = 0
  let j2len = new Map<number, number>()
  for (let i = aLo; i < aHi; i++) {
    const newJ2len = new Map<number, number>()
    for (let j = bLo; j < bHi; j++) {
      if (a[i] === b[j]) {
        const k = (j2len.get(j - 1) ?? 0) + 1
        newJ2len.set(j, k)
        if (k > bestSize) { bestI = i - k + 1; bestJ = j - k + 1; bestSize = k }
      }
    }
    j2len = newJ2len
  }
  return [bestI, bestJ, bestSize] as const
}

function seqRatio(a: string, b: string): number {
  if (!a.length && !b.length) return 1
  let total = 0
  const stack: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]]
  while (stack.length) {
    const [aLo, aHi, bLo, bHi] = stack.pop()!
    const [i, j, k] = findLongestMatch(a, b, aLo, aHi, bLo, bHi)
    if (k === 0) continue
    total += k
    if (aLo < i && bLo < j) stack.push([aLo, i, bLo, j])
    if (i + k < aHi && j + k < bHi) stack.push([i + k, aHi, j + k, bHi])
  }
  return (2 * total) / (a.length + b.length)
}

function tokenMatches(pTok: string, nameToks: string[]): boolean {
  for (const nt of nameToks) {
    if (nt.startsWith(pTok) || pTok.startsWith(nt)) return true
    if (pTok.length > 3 && seqRatio(pTok, nt) >= 0.82) return true
  }
  return false
}

export function matchArtist(campaignName: string, artists: Artist[]): Artist | null {
  if (!campaignName) return null
  const ordered = [...artists].sort((a, b) => (b.namePattern?.length ?? 0) - (a.namePattern?.length ?? 0))
  const nameUpper = campaignName.toUpperCase()
  const nameNorm = normalizeText(campaignName)
  const nameToks = tokenize(campaignName)

  for (const a of ordered) {
    const pat = (a.namePattern ?? '').toUpperCase()
    if (pat && nameUpper.includes(pat)) return a
  }
  for (const a of ordered) {
    const patNorm = normalizeText(a.namePattern ?? '')
    if (patNorm && nameNorm.includes(patNorm)) return a
  }
  for (const a of ordered) {
    const pToks = tokenize(a.namePattern ?? '')
    if (pToks.length && pToks.every((pt) => tokenMatches(pt, nameToks))) return a
  }
  return null
}

export function detectYoutubeType(name: string): string {
  const n = (name ?? '').toUpperCase()
  if (n.includes('FOLLOW')) return 'follow_on_views'
  if (/(SUSCRI|SUBSCRI|SUB )/.test(n)) return 'subscribers'
  if (/THRU ?VIEW/.test(n)) return 'thruview'
  return 'follow_on_views'
}

// ─────────────────────────── Lecturas (Supabase) ───────────────────────────

type DbCampaign = {
  id: string
  name: string
  platform: string
  youtube_type: string | null
  status: string
  budget_total: number | null
  artist_id: string
}

export async function getArtistMetrics(
  artist: Artist,
  dateFrom: string,
  platform?: string | null,
  dateTo?: string | null
): Promise<MetricRow[]> {
  const db = getDb()

  let query = db
    .from('campaign_metrics')
    .select('*, campaigns!inner (id, name, platform, youtube_type, status, budget_total, artist_id)')
    .eq('campaigns.artist_id', artist.id)
    .gte('date', dateFrom)
    .order('date', { ascending: false })

  if (dateTo) query = query.lte('date', dateTo)
  if (platform) query = query.eq('campaigns.platform', platform)

  const { data, error } = await query
  if (error) throw new Error(`Supabase: ${error.message}`)

  // Proyecto derivado una sola vez por campaña
  const projectCache = new Map<string, { key: string; label: string }>()

  return (data ?? []).map((row) => {
    const c = row.campaigns as DbCampaign
    if (!projectCache.has(c.id)) projectCache.set(c.id, deriveProject(c.name, artist))
    const project = projectCache.get(c.id)!
    // raw_data se queda en la base; no hace falta enviarlo al navegador
    const { raw_data: _rawData, ...rest } = row
    void _rawData
    return {
      ...rest,
      campaigns: {
        id: c.id,
        name: c.name,
        platform: c.platform,
        youtube_type: c.youtube_type,
        status: c.status,
        budget_total: c.budget_total,
        project: project.label,
        projectKey: project.key,
      },
    } as MetricRow
  })
}

// Para el grid: plataformas con historial por artista (una sola consulta ligera)
export async function getActivePlatformsByArtist(): Promise<Map<string, Set<string>>> {
  const db = getDb()
  const { data, error } = await db.from('campaigns').select('artist_id, platform')
  if (error) throw new Error(`Supabase: ${error.message}`)

  const map = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    if (!map.has(row.artist_id)) map.set(row.artist_id, new Set())
    map.get(row.artist_id)!.add(row.platform)
  }
  return map
}

export { getArtists }
