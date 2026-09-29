// Conteos públicos por lanzamiento.
// El catálogo (publicViews) es el respaldo manual. /api/sync, si hay
// YOUTUBE_API_KEY, guarda el conteo fresco en release_public_views.

import { getDb } from './db'
import { getAllReleases, type Release } from './releases'
import { fetchPublicViewCounts, youtubeApiKey } from './youtubePublic'

export type StoredPublicViews = {
  publicViews: number
  fetchedAt: string
}

type SaveRow = {
  release_id: string
  youtube_video_id: string
  public_views: number
  fetched_at: string
}

function canReadDb() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function displayPublicViews(
  release: Pick<Release, 'publicViews' | 'publicViewsFetchedAt'>,
  stored: StoredPublicViews | undefined
): { publicViews: number | null; publicViewsFetchedAt: string | null } {
  if (stored) return { publicViews: stored.publicViews, publicViewsFetchedAt: stored.fetchedAt }
  return {
    publicViews: release.publicViews,
    publicViewsFetchedAt: release.publicViewsFetchedAt,
  }
}

export async function readStoredPublicViews(releaseIds: string[]): Promise<Map<string, StoredPublicViews>> {
  const map = new Map<string, StoredPublicViews>()
  if (!canReadDb() || !releaseIds.length) return map
  try {
    const db = getDb()
    const { data, error } = await db
      .from('release_public_views')
      .select('release_id, public_views, fetched_at')
      .in('release_id', releaseIds)
    if (error || !data) return map
    for (const row of data) {
      const views = Number(row.public_views)
      const fetchedAt = row.fetched_at == null ? '' : String(row.fetched_at)
      if (!row.release_id || !Number.isFinite(views) || !fetchedAt) continue
      map.set(String(row.release_id), { publicViews: views, fetchedAt })
    }
  } catch (err) {
    console.error('[publicViews] no se pudo leer el conteo guardado:', err)
  }
  return map
}

export async function syncReleasePublicViews(): Promise<Record<string, unknown>> {
  if (!youtubeApiKey()) return { skipped: 'sin YOUTUBE_API_KEY' }

  const releases = getAllReleases().filter((release) => release.youtubeVideoId)
  const fetchedAt = new Date().toISOString()
  try {
    const counts = await fetchPublicViewCounts(releases.map((release) => release.youtubeVideoId as string))
    const rows: SaveRow[] = []
    for (const release of releases) {
      const views = counts.get(release.youtubeVideoId as string)
      if (views == null) continue
      rows.push({
        release_id: release.id,
        youtube_video_id: release.youtubeVideoId as string,
        public_views: views,
        fetched_at: fetchedAt,
      })
    }
    if (!rows.length) return { updated: 0, fetchedAt }

    if (!canReadDb()) return { updated: 0, fetchedAt, error: 'sin base para guardar el conteo' }

    const db = getDb()
    const { error } = await db.from('release_public_views').upsert(rows, { onConflict: 'release_id' })
    if (error) return { updated: 0, fetchedAt, error: error.message }
    return { updated: rows.length, fetchedAt }
  } catch (err) {
    return { fetchedAt, error: err instanceof Error ? err.message : String(err) }
  }
}
