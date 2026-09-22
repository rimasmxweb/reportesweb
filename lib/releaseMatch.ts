// Empareja campañas ya sincronizadas con un lanzamiento del catálogo.
// La comparación es explícita (frase o token en el nombre), no la heurística de projects.ts.

export type NameMatchMode = 'contains' | 'token'

export type NamePattern = {
  text: string
  mode: NameMatchMode
}

export type ReleaseType = 'single'

export type Release = {
  artistSlug: string
  artistId: string
  slug: string
  type: ReleaseType
  title: string
  nameContains: NamePattern[]
  mapping: string
}

export function normalizeCampaignName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function campaignNameMatches(campaignName: string, patterns: NamePattern[]): boolean {
  const name = normalizeCampaignName(campaignName)
  if (!name) return false

  return patterns.some((pattern) => {
    const text = normalizeCampaignName(pattern.text)
    if (!text) return false
    if (pattern.mode === 'token') {
      const re = new RegExp(`(?:^|\\s)${escapeRegExp(text)}(?:\\s|$)`)
      return re.test(name)
    }
    return name.includes(text)
  })
}
