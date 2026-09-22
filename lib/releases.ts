import raw from './data/releases.json'
import { getArtistBySlug } from './config'
import {
  campaignNameMatches,
  type NameMatchMode,
  type Release,
  type ReleaseType,
} from './releaseMatch'

type Catalog = {
  documentation: string
  releases: Release[]
}

const MODES: NameMatchMode[] = ['contains', 'token']
const TYPES: ReleaseType[] = ['single']

function assertCatalog(releases: Release[]) {
  const seen = new Set<string>()
  for (const release of releases) {
    const artist = getArtistBySlug(release.artistSlug)
    if (!artist) {
      throw new Error(
        `Catálogo de lanzamientos: no existe el artista «${release.artistSlug}» (${release.slug})`
      )
    }
    if (artist.id !== release.artistId) {
      throw new Error(
        `Catálogo de lanzamientos: artistId de «${release.slug}» no coincide con ${artist.slug}`
      )
    }
    const key = `${release.artistSlug}/${release.slug}`
    if (seen.has(key)) throw new Error(`Catálogo de lanzamientos: slug repetido ${key}`)
    seen.add(key)
    if (!TYPES.includes(release.type)) {
      throw new Error(`Catálogo de lanzamientos: tipo no soportado en «${release.slug}»`)
    }
    if (!release.title?.trim()) {
      throw new Error(`Catálogo de lanzamientos: falta el título en «${release.slug}»`)
    }
    if (!release.nameContains?.length) {
      throw new Error(`Catálogo de lanzamientos: «${release.slug}» no define nameContains`)
    }
    for (const pattern of release.nameContains) {
      if (!MODES.includes(pattern.mode)) {
        throw new Error(`Catálogo de lanzamientos: mode inválido en «${release.slug}»`)
      }
      if (!pattern.text?.trim()) {
        throw new Error(`Catálogo de lanzamientos: patrón vacío en «${release.slug}»`)
      }
    }
  }
}

const catalog = raw as Catalog
assertCatalog(catalog.releases)

export function getReleasesForArtist(artistSlug: string): Release[] {
  return catalog.releases.filter((release) => release.artistSlug === artistSlug)
}

export function getRelease(artistSlug: string, releaseSlug: string): Release | undefined {
  return catalog.releases.find(
    (release) => release.artistSlug === artistSlug && release.slug === releaseSlug
  )
}

export function campaignMatchesRelease(campaignName: string, release: Release): boolean {
  return campaignNameMatches(campaignName, release.nameContains)
}

export function filterMetricsForRelease<T extends { campaigns: { name: string } }>(
  rows: T[],
  release: Release
): T[] {
  return rows.filter((row) => campaignMatchesRelease(row.campaigns?.name ?? '', release))
}

export function releaseTypeLabel(type: ReleaseType): string {
  if (type === 'single') return 'Sencillo'
  return type
}

export type { Release }
