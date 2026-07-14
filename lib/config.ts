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
