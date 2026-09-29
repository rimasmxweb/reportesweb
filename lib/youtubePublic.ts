// Vistas públicas del video oficial. No usa la sesión del canal:
// videos.list?part=statistics devuelve el mismo conteo que se ve bajo el video.

const API = 'https://www.googleapis.com/youtube/v3/videos'

export function youtubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  return key ? key : null
}

export async function fetchPublicViewCounts(videoIds: string[]): Promise<Map<string, number>> {
  const key = youtubeApiKey()
  const unique = [...new Set(videoIds.map((id) => id.trim()).filter(Boolean))]
  if (!key || !unique.length) return new Map()

  const params = new URLSearchParams({
    part: 'statistics',
    id: unique.join(','),
    key,
  })
  const res = await fetch(`${API}?${params}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube Data API ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const counts = new Map<string, number>()
  for (const item of data.items ?? []) {
    const views = Number(item?.statistics?.viewCount)
    if (typeof item?.id === 'string' && Number.isFinite(views)) counts.set(item.id, views)
  }
  return counts
}
