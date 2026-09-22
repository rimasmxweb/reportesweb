import raw from './data/releases.json'

// Catálogo explícito de releases. El sync sigue asignando campañas al artista;
// estos patrones solo filtran filas ya sincronizadas para los KPIs del release.
// No hay nombres de campaña reales en el repo (viven en Supabase). Los matchers
// siguen las formas documentadas en lib/projects.ts: "Artista - Título (tipo)"
// y "Artista | Título | tipo".

export type ReleaseType = 'single' | 'ep' | 'album'
export type ReleaseStatus = 'active' | 'paused' | 'ended'
export type AdsPlatform = 'youtube' | 'meta' | 'tiktok'

export type Release = {
  artistSlug: string
  slug: string
  title: string
  type: ReleaseType
  status?: ReleaseStatus
  adsPlatforms: AdsPlatform[]
  campaignNameIncludes: string[]
}

type RawRelease = {
  artistSlug: string
  slug: string
  title: string
  type: ReleaseType
  status?: ReleaseStatus
  adsPlatforms?: AdsPlatform[]
  campaignNameIncludes?: string[]
}

const data = raw as { releases: RawRelease[] }

export const RELEASE_TYPE_LABEL: Record<ReleaseType, string> = {
  single: 'Single',
  ep: 'EP',
  album: 'Álbum',
}

export const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
  active: 'Activo',
  paused: 'Pausado',
  ended: 'Finalizado',
}

export const ADS_PLATFORM_LABEL: Record<AdsPlatform, string> = {
  youtube: 'YouTube',
  meta: 'Meta',
  tiktok: 'TikTok',
}

function hydrate(release: RawRelease): Release {
  const includes = release.campaignNameIncludes?.map((p) => p.trim()).filter(Boolean) ?? []
  return {
    artistSlug: release.artistSlug,
    slug: release.slug,
    title: release.title,
    type: release.type,
    status: release.status,
    adsPlatforms: release.adsPlatforms ?? [],
    campaignNameIncludes: includes.length > 0 ? includes : [release.title],
  }
}

const releases = data.releases.map(hydrate)

export function getReleasesForArtist(artistSlug: string): Release[] {
  return releases.filter((release) => release.artistSlug === artistSlug)
}

export function getRelease(artistSlug: string, releaseSlug: string): Release | undefined {
  return getReleasesForArtist(artistSlug).find((release) => release.slug === releaseSlug)
}

function normalizeName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesPattern(campaignName: string, patternRaw: string): boolean {
  const name = normalizeName(campaignName)
  const pattern = normalizeName(patternRaw)
  if (!name || !pattern) return false

  const isToken = !pattern.includes(' ') && pattern.length <= 4
  if (isToken) {
    if (new RegExp(`(?:^| )${escapeRegExp(pattern)}(?: |$)`).test(name)) return true
    // "D.N.D" / "D N D" sobreviven a la normalización como letras sueltas.
    if (pattern.length <= 3) {
      const spaced = pattern.split('').join(' ')
      if (name === spaced || name.startsWith(`${spaced} `) || name.endsWith(` ${spaced}`) || name.includes(` ${spaced} `)) {
        return true
      }
    }
    return false
  }

  if (name.includes(pattern)) return true
  const compactName = name.replace(/ /g, '')
  const compactPattern = pattern.replace(/ /g, '')
  return compactPattern.length >= 8 && compactName.includes(compactPattern)
}

export function campaignMatchesRelease(campaignName: string, release: Release): boolean {
  return release.campaignNameIncludes.some((pattern) => matchesPattern(campaignName, pattern))
}

export function filterMetricsForRelease<T extends { campaigns?: { name?: string } | null }>(
  rows: T[],
  release: Release,
): T[] {
  return rows.filter((row) => campaignMatchesRelease(row.campaigns?.name ?? '', release))
}
