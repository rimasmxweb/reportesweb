import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getArtists } from '@/lib/config'
import { fetchAllCampaignRows, GoogleAdsRow, isGoogleStatusActive } from '@/lib/googleAds'
import { fetchAllMetaRows, MetaRow, fetchAllCampaignStatuses, isMetaStatusActive } from '@/lib/meta'
import { fetchAllTikTokRows, TikTokRow } from '@/lib/windsorTiktok'
import { getFxRates, toUsd } from '@/lib/fx'
import { matchArtist, detectYoutubeType } from '@/lib/campaignData'

// Sincroniza Google Ads + Meta + TikTok (vía Windsor) → Supabase. Lo dispara
// el cron de Vercel (diario) o una llamada manual con ?days=400 para backfill.
// El tráfico diario del cron además evita que Supabase se pause por inactividad.

export const maxDuration = 300

const ACTIVE_WINDOW_DAYS = 3
const CHUNK = 500

function round(n: number, d: number) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

// Estado por actividad reciente — solo se usa cuando la plataforma no nos da
// un estado real (fallback, no la fuente de verdad).
function activityStatus(lastActivity: string | null, today: number): string {
  const daysSince = lastActivity
    ? Math.floor((today - new Date(lastActivity).getTime()) / 86_400_000)
    : Infinity
  return daysSince <= ACTIVE_WINDOW_DAYS ? 'active' : 'ended'
}

type CampaignRow = Record<string, unknown> & { windsor_campaign_id: string; platform: string }

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const token = new URL(request.url).searchParams.get('token')
  const secret = process.env.CRON_SECRET
  if (!secret || (auth !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const started = Date.now()
  const { searchParams } = new URL(request.url)
  const days = Math.min(parseInt(searchParams.get('days') ?? '3'), 730)

  const dateTo = new Date().toISOString().slice(0, 10)
  const dateFrom = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  const db = getDb()
  const artists = getArtists()
  const rates = await getFxRates()
  const today = Date.now()

  const allCampaignRows: CampaignRow[] = []
  const allMetricRows: Record<string, unknown>[] = []
  const unmatched = new Set<string>()
  const errors: string[] = []

  // ─────────────────────────── Google Ads (YouTube) ───────────────────────────
  try {
    const rows = await fetchAllCampaignRows(dateFrom, dateTo)

    type GMeta = { artistId: string; name: string; lastActivity: string | null; platformStatus: string; rows: GoogleAdsRow[] }
    const campaigns = new Map<string, GMeta>()

    for (const r of rows) {
      const artist = matchArtist(r.campaignName, artists)
      if (!artist) { unmatched.add(r.campaignName); continue }
      if (!campaigns.has(r.campaignId)) {
        campaigns.set(r.campaignId, { artistId: artist.id, name: r.campaignName, lastActivity: null, platformStatus: r.status, rows: [] })
      }
      const meta = campaigns.get(r.campaignId)!
      meta.rows.push(r)
      meta.platformStatus = r.status // el más reciente basta, no cambia por fecha
      if ((r.impressions > 0 || r.cost > 0) && (!meta.lastActivity || r.date > meta.lastActivity)) {
        meta.lastActivity = r.date
      }
    }

    for (const [id, meta] of campaigns) {
      // Estado real de Google Ads (ENABLED/PAUSED/REMOVED) — no heurística.
      const status = isGoogleStatusActive(meta.platformStatus) ? 'active' : 'ended'
      allCampaignRows.push({
        artist_id: meta.artistId,
        windsor_campaign_id: id,
        name: meta.name,
        platform: 'google_youtube',
        youtube_type: detectYoutubeType(meta.name),
        status,
        updated_at: new Date().toISOString(),
      })

      const nameUpper = meta.name.toUpperCase()
      const isSubs = /(SUSCRI|SUBSCRI|SUB )/.test(nameUpper)
      const isFollow = nameUpper.includes('FOLLOW')

      for (const r of meta.rows) {
        const spendUsd = toUsd(r.cost, r.currency, rates) ?? 0
        const conv = Math.round(r.conversions || 0)
        allMetricRows.push({
          __extId: id,
          __platform: 'google_youtube',
          date: r.date,
          impressions: r.impressions,
          total_spend: round(spendUsd, 4),
          ctr: round(r.ctr * 100, 4),
          cpm: round(toUsd(r.cpm, r.currency, rates) ?? 0, 4),
          thruviews: r.videoViews,
          public_views: r.videoViews,
          subscriber_conversions: isSubs ? conv : 0,
          follow_on_view_conversions: isFollow ? conv : 0,
          video_retention: r.p100 != null ? round(r.p100 * 100, 2) : null,
          view_rate: r.p25 != null ? round(r.p25 * 100, 2) : null,
          cost_per_view: spendUsd && r.videoViews ? round(spendUsd / r.videoViews, 4) : null,
          cost_per_conversion: spendUsd && conv ? round(spendUsd / conv, 4) : null,
          raw_data: JSON.stringify(r),
        })
      }
    }
  } catch (err) {
    errors.push(`Google Ads: ${String(err)}`)
  }

  // ─────────────────────────── Meta (Facebook/Instagram) ───────────────────────────
  try {
    const [rows, statuses] = await Promise.all([
      fetchAllMetaRows(dateFrom, dateTo),
      fetchAllCampaignStatuses(),
    ])

    type MMeta = { artistId: string; name: string; lastActivity: string | null; rows: MetaRow[] }
    const campaigns = new Map<string, MMeta>()

    for (const r of rows) {
      const artist = matchArtist(r.campaignName, artists)
      if (!artist) { unmatched.add(r.campaignName); continue }
      if (!campaigns.has(r.campaignId)) {
        campaigns.set(r.campaignId, { artistId: artist.id, name: r.campaignName, lastActivity: null, rows: [] })
      }
      const meta = campaigns.get(r.campaignId)!
      meta.rows.push(r)
      if ((r.impressions > 0 || r.cost > 0) && (!meta.lastActivity || r.date > meta.lastActivity)) {
        meta.lastActivity = r.date
      }
    }

    for (const [id, meta] of campaigns) {
      // Estado real de Meta (effective_status) si lo obtuvimos; si la llamada
      // de estados falló, cae de vuelta a la heurística de actividad.
      const realStatus = statuses.get(id)
      const status = realStatus != null
        ? (isMetaStatusActive(realStatus) ? 'active' : 'ended')
        : activityStatus(meta.lastActivity, today)

      allCampaignRows.push({
        artist_id: meta.artistId,
        windsor_campaign_id: id,
        name: meta.name,
        platform: 'meta',
        youtube_type: null,
        status,
        updated_at: new Date().toISOString(),
      })

      for (const r of meta.rows) {
        const spendUsd = toUsd(r.cost, r.currency, rates) ?? 0
        allMetricRows.push({
          __extId: id,
          __platform: 'meta',
          date: r.date,
          impressions: r.impressions,
          total_spend: round(spendUsd, 4),
          ctr: round(r.ctr, 4),
          cpm: round(toUsd(r.cpm, r.currency, rates) ?? 0, 4),
          reach: r.reach,
          thruplay: r.thruplay,
          result_count: r.resultCount,
          cost_per_result: r.costPerResult != null ? round(toUsd(r.costPerResult, r.currency, rates) ?? 0, 4) : null,
          raw_data: JSON.stringify(r),
        })
      }
    }
  } catch (err) {
    errors.push(`Meta: ${String(err)}`)
  }

  // ─────────────────────────── TikTok (vía Windsor) ───────────────────────────
  try {
    const rows = await fetchAllTikTokRows(dateFrom, dateTo)

    type TMeta = { artistId: string; name: string; platformStatus: string; rows: TikTokRow[] }
    const campaigns = new Map<string, TMeta>()

    for (const r of rows) {
      const artist = matchArtist(r.campaignName, artists)
      if (!artist) { unmatched.add(r.campaignName); continue }
      if (!campaigns.has(r.campaignId)) {
        campaigns.set(r.campaignId, { artistId: artist.id, name: r.campaignName, platformStatus: r.status, rows: [] })
      }
      const meta = campaigns.get(r.campaignId)!
      meta.rows.push(r)
      meta.platformStatus = r.status
    }

    for (const [id, meta] of campaigns) {
      // Windsor ya nos da el estado real de TikTok (campaign_status) — sin heurística.
      allCampaignRows.push({
        artist_id: meta.artistId,
        windsor_campaign_id: id,
        name: meta.name,
        platform: 'tiktok',
        youtube_type: null,
        status: meta.platformStatus,
        updated_at: new Date().toISOString(),
      })

      for (const r of meta.rows) {
        const spendUsd = toUsd(r.cost, r.currency, rates) ?? 0
        allMetricRows.push({
          __extId: id,
          __platform: 'tiktok',
          date: r.date,
          impressions: r.impressions,
          total_spend: round(spendUsd, 4),
          ctr: round(r.ctr * 100, 4),
          cpm: round(toUsd(r.cpm, r.currency, rates) ?? 0, 4),
          reach: r.reach,
          thruplay: r.thruplay,
          result_count: r.resultCount,
          cost_per_result: r.costPerResult != null ? round(toUsd(r.costPerResult, r.currency, rates) ?? 0, 4) : null,
          raw_data: JSON.stringify(r),
        })
      }
    }
  } catch (err) {
    errors.push(`TikTok: ${String(err)}`)
  }

  if (!allCampaignRows.length) {
    return NextResponse.json({ error: 'Sin datos de ninguna plataforma', errors }, { status: 502 })
  }

  // ─────────────────────────── Upsert a Supabase ───────────────────────────
  const { data: upserted, error: campErr } = await db
    .from('campaigns')
    .upsert(allCampaignRows, { onConflict: 'windsor_campaign_id,platform' })
    .select('id,windsor_campaign_id,platform')
  if (campErr) {
    return NextResponse.json({ error: `Supabase campaigns: ${campErr.message}`, errors }, { status: 502 })
  }

  const idMap = new Map<string, string>() // `${platform}:${extId}` → uuid
  for (const row of upserted ?? []) idMap.set(`${row.platform}:${row.windsor_campaign_id}`, row.id)

  // Windsor (TikTok) a veces devuelve filas idénticas duplicadas para la misma
  // campaña+fecha. El upsert usa (campaign_id,date) como llave de conflicto y
  // Postgres rechaza un batch que toque la misma fila dos veces ("ON CONFLICT
  // DO UPDATE command cannot affect row a second time"). Colapsamos por
  // (campaign_id,date) — son idénticas, así que quedarnos con la última no
  // pierde ni suma nada. Google y Meta ya vienen únicos por campaña+fecha.
  const metricByKey = new Map<string, Record<string, unknown>>()
  let matched = 0
  for (const m of allMetricRows) {
    const { __extId, __platform, ...rest } = m as { __extId: string; __platform: string } & Record<string, unknown>
    const uuid = idMap.get(`${__platform}:${__extId}`)
    if (!uuid) continue
    matched++
    metricByKey.set(`${uuid}|${rest.date}`, { campaign_id: uuid, ...rest })
  }
  const metricRows = [...metricByKey.values()]
  const collapsedDupes = matched - metricRows.length

  let synced = 0
  for (let i = 0; i < metricRows.length; i += CHUNK) {
    const chunk = metricRows.slice(i, i + CHUNK)
    const { error } = await db.from('campaign_metrics').upsert(chunk, { onConflict: 'campaign_id,date' })
    if (error) {
      return NextResponse.json(
        { error: `Supabase metrics (fila ${i}): ${error.message}`, synced, errors },
        { status: 502 }
      )
    }
    synced += chunk.length
  }

  return NextResponse.json({
    ok: true,
    range: { from: dateFrom, to: dateTo },
    campaigns: allCampaignRows.length,
    metricsSynced: synced,
    collapsedDupes,
    unmatched: [...unmatched].sort(),
    errors,
    ms: Date.now() - started,
  })
}
