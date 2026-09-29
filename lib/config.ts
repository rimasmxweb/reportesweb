import raw from './data/config.json'

export type Artist = {
  id: string
  name: string
  slug: string
  namePattern: string
  active: boolean
}

export type ProjectManager = {
  id: string
  name: string
  email: string
  accessCode: string
  featuredArtistId?: string
  artistIds: string[]
}

const config = raw as { artists: Artist[]; projectManagers: ProjectManager[] }

export function getArtists(): Artist[] {
  return config.artists.filter((a) => a.active)
}

export function getArtistBySlug(slug: string): Artist | undefined {
  return config.artists.find((a) => a.slug === slug && a.active)
}

export function getArtistById(id: string): Artist | undefined {
  return config.artists.find((a) => a.id === id)
}

export function getPmByAccessCode(code: string): ProjectManager | undefined {
  const normalized = code.trim().toUpperCase()
  return config.projectManagers.find((p) => p.accessCode === normalized)
}

export function getPmById(id: string): ProjectManager | undefined {
  return config.projectManagers.find((pm) => pm.id === id)
}

export function getFeaturedPm(slug: string): ProjectManager | undefined {
  const artist = getArtistBySlug(slug)
  if (!artist) return undefined
  return config.projectManagers.find(
    (pm) => pm.featuredArtistId === artist.id && pm.artistIds.includes(artist.id)
  )
}

export function landingPathForPm(pm: ProjectManager): string {
  const featuredId = pm.featuredArtistId
  if (!featuredId || !pm.artistIds.includes(featuredId)) return '/dashboard'
  const artist = getArtistById(featuredId)
  return artist ? `/dashboard/${artist.slug}` : '/dashboard'
}
