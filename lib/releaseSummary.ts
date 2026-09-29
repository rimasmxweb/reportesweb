// Resumen de pauta de un lanzamiento. Solo usa columnas de gasto y
// reproducciones pagadas. Las vistas públicas del video oficial no entran aquí.

export const PAID_PLATFORMS = ['google_youtube', 'tiktok', 'meta'] as const

export type PaidPlatform = (typeof PAID_PLATFORMS)[number]

export type PaidMetric = {
  date: string
  impressions: number | null
  total_spend: number | null
  thruviews: number | null
  thruplay: number | null
  campaigns: { platform: string } | null
}

export type PlatformSummary = {
  platform: PaidPlatform
  label: string
  playsLabel: string
  hasRows: boolean
  spendUsd: number
  impressions: number
  plays: number
  cpvUsd: number | null
}

export type DailySpend = {
  date: string
  google_youtube: number
  tiktok: number
  meta: number
}

export type PaidSummary = {
  hasRows: boolean
  spendUsd: number
  platforms: PlatformSummary[]
  daily: DailySpend[]
}

const PLATFORM_COPY: Record<PaidPlatform, { label: string; playsLabel: string }> = {
  google_youtube: { label: 'YouTube', playsLabel: 'Vistas' },
  tiktok: { label: 'TikTok', playsLabel: 'Reproducciones' },
  meta: { label: 'Meta', playsLabel: 'Reproducciones' },
}

export function playsForPlatform(
  platform: string,
  row: { thruviews: number | null; thruplay: number | null }
): number {
  if (platform === 'google_youtube') return row.thruviews ?? 0
  if (platform === 'tiktok' || platform === 'meta') return row.thruplay ?? 0
  return 0
}

function emptyPlatform(platform: PaidPlatform): PlatformSummary {
  const copy = PLATFORM_COPY[platform]
  return {
    platform,
    label: copy.label,
    playsLabel: copy.playsLabel,
    hasRows: false,
    spendUsd: 0,
    impressions: 0,
    plays: 0,
    cpvUsd: null,
  }
}

export function summarizePaidMedia(rows: PaidMetric[]): PaidSummary {
  const platforms = new Map<PaidPlatform, PlatformSummary>(
    PAID_PLATFORMS.map((platform) => [platform, emptyPlatform(platform)])
  )
  const byDate = new Map<string, DailySpend>()

  for (const row of rows) {
    const platform = row.campaigns?.platform
    if (!platform || !platforms.has(platform as PaidPlatform)) continue
    const bucket = platforms.get(platform as PaidPlatform)!
    const spend = row.total_spend ?? 0
    bucket.hasRows = true
    bucket.spendUsd += spend
    bucket.impressions += row.impressions ?? 0
    bucket.plays += playsForPlatform(platform, row)

    const day = byDate.get(row.date) ?? {
      date: row.date,
      google_youtube: 0,
      tiktok: 0,
      meta: 0,
    }
    day[platform as PaidPlatform] += spend
    byDate.set(row.date, day)
  }

  const list = PAID_PLATFORMS.map((platform) => {
    const bucket = platforms.get(platform)!
    bucket.cpvUsd = bucket.plays > 0 ? bucket.spendUsd / bucket.plays : null
    return bucket
  })

  return {
    hasRows: list.some((platform) => platform.hasRows),
    spendUsd: list.reduce((sum, platform) => sum + platform.spendUsd, 0),
    platforms: list,
    daily: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function spendMxn(spendUsd: number, usdToMxn: number | null): number | null {
  if (usdToMxn == null || !Number.isFinite(usdToMxn) || usdToMxn <= 0) return null
  return spendUsd * usdToMxn
}
