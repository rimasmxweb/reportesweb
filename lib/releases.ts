import raw from './data/releases.json'
import { getArtistBySlug } from './config'
import {
  campaignNameMatches,
  type NameMatchMode,
  type Release,
  type ReleasePhase,
  type ReleaseType,
} from './releaseMatch'

type Catalog = {
  documentation: string
  releases: Release[]
}

const MODES: NameMatchMode[] = ['contains', 'token']
const TYPES: ReleaseType[] = ['single', 'ep', 'album']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertCatalog(releases: Release[]) {
  const seenSlug = new Set<string>()
  const seenId = new Set<string>()
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
    if (seenSlug.has(key)) throw new Error(`Catálogo de lanzamientos: slug repetido ${key}`)
    seenSlug.add(key)
    if (!TYPES.includes(release.type)) {
      throw new Error(`Catálogo de lanzamientos: tipo no soportado en «${release.slug}»`)
    }
    if (!release.id?.trim()) {
      throw new Error(`Catálogo de lanzamientos: falta el id en «${release.slug}»`)
    }
    if (seenId.has(release.id)) {
      throw new Error(`Catálogo de lanzamientos: id repetido en «${release.slug}»`)
    }
    seenId.add(release.id)
    if (!release.title?.trim()) {
      throw new Error(`Catálogo de lanzamientos: falta el título en «${release.slug}»`)
    }
    if (typeof release.active !== 'boolean') {
      throw new Error(`Catálogo de lanzamientos: active debe ser sí o no en «${release.slug}»`)
    }
    if (!DATE_RE.test(release.campaignStart ?? '')) {
      throw new Error(`Catálogo de lanzamientos: campaignStart inválido en «${release.slug}»`)
    }
    if (release.youtubeVideoId != null && !/^[A-Za-z0-9_-]{11}$/.test(release.youtubeVideoId)) {
      throw new Error(`Catálogo de lanzamientos: youtubeVideoId inválido en «${release.slug}»`)
    }
    if (
      release.publicViews != null &&
      (!Number.isFinite(release.publicViews) || release.publicViews < 0 || !Number.isInteger(release.publicViews))
    ) {
      throw new Error(`Catálogo de lanzamientos: vistas públicas inválidas en «${release.slug}»`)
    }
    if (release.publicViews == null && release.publicViewsFetchedAt != null) {
      throw new Error(`Catálogo de lanzamientos: hay fecha de consulta sin vistas en «${release.slug}»`)
    }
    if (release.publicViews != null && !release.publicViewsFetchedAt) {
      throw new Error(`Catálogo de lanzamientos: faltan la fecha de las vistas públicas en «${release.slug}»`)
    }
    if (release.publicViewsFetchedAt != null && Number.isNaN(Date.parse(release.publicViewsFetchedAt))) {
      throw new Error(`Catálogo de lanzamientos: fecha de vistas públicas inválida en «${release.slug}»`)
    }
    if (release.song != null && !release.song.trim()) {
      throw new Error(`Catálogo de lanzamientos: canción vacía en «${release.slug}»`)
    }
    if (release.piece != null && !release.piece.trim()) {
      throw new Error(`Catálogo de lanzamientos: pieza vacía en «${release.slug}»`)
    }
    if (release.note != null && !release.note.trim()) {
      throw new Error(`Catálogo de lanzamientos: nota vacía en «${release.slug}»`)
    }
    if (release.phases != null) {
      if (!Array.isArray(release.phases)) {
        throw new Error(`Catálogo de lanzamientos: fases inválidas en «${release.slug}»`)
      }
      const seenPhase = new Set<string>()
      for (const phase of release.phases) {
        assertPhase(release.slug, phase)
        const key = `${phase.date}|${phase.title}`
        if (seenPhase.has(key)) {
          throw new Error(`Catálogo de lanzamientos: fase repetida en «${release.slug}»`)
        }
        seenPhase.add(key)
      }
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

function assertPhase(slug: string, phase: ReleasePhase) {
  if (!DATE_RE.test(phase?.date ?? '')) {
    throw new Error(`Catálogo de lanzamientos: fecha de fase inválida en «${slug}»`)
  }
  if (!phase.title?.trim() || !phase.detail?.trim()) {
    throw new Error(`Catálogo de lanzamientos: fase incompleta en «${slug}»`)
  }
}

const catalog = raw as Catalog
assertCatalog(catalog.releases)

export function getAllReleases(): Release[] {
  return catalog.releases
}

export function getReleasesForArtist(artistSlug: string): Release[] {
  return catalog.releases.filter((release) => release.artistSlug === artistSlug)
}

export function getRelease(artistSlug: string, releaseSlug: string): Release | undefined {
  return catalog.releases.find(
    (release) => release.artistSlug === artistSlug && release.slug === releaseSlug
  )
}

// El hero del artista usa solo este lanzamiento: el activo con el inicio de
// campaña más reciente. No suma vistas entre lanzamientos.
export function getLatestActiveRelease(artistSlug: string): Release | undefined {
  return getReleasesForArtist(artistSlug)
    .filter((release) => release.active)
    .sort((a, b) => {
      const byStart = b.campaignStart.localeCompare(a.campaignStart)
      if (byStart !== 0) return byStart
      return a.slug.localeCompare(b.slug)
    })[0]
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
  if (type === 'ep') return 'EP'
  if (type === 'album') return 'Álbum'
  return type
}

export type { Release }
