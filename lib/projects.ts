import { Artist } from './config'

// Deriva el proyecto/canción a partir del nombre de la campaña.
// Los nombres siguen el patrón "Artista - Canción (tipo de campaña)":
//   "Big Soto - Nostalgia City (All Content - FollowOn-Views)" → Nostalgia City
//   "Neutro | F1 🔵 | Mente Loca | Alcance"                    → Mente Loca
//   "Big Soto x Knak - TRES (Multiformato)"                    → Tres
// La regla: quitar paréntesis/corchetes, partir por separadores, descartar el
// segmento del artista y la jerga de tipo de campaña; lo que queda es la canción.

// Frases de tipo de campaña (se quitan ANTES de tokenizar, para no romper
// títulos como "ALL IN IT" con los tokens sueltos "all"/"in")
const PHRASES = [
  'all content', 'in stream', 'in feed', 'follow on views', 'followon views',
  'follow on', 'pre save', 'trafico caliente', 'trafico frio', 'new song',
  'tráfico caliente', 'tráfico frío',
]

// Tokens de jerga de campaña (ninguno debería aparecer en títulos de canciones)
const STOP_TOKENS = new Set([
  'follow', 'followon', 'followonviews', 'views', 'view', 'vistas',
  'subs', 'sub', 'suscriptores', 'suscriptor', 'subscribers', 'subscriber', 'subscribe',
  'campaign', 'campaing', 'camp', 'campana',
  'instream', 'infeed', 'multiformato', 'multiplataforma', 'multiplatafroma',
  'remarketing', 'rmkt', 'rmk',
  'trafico', 'traffic', 'alcance', 'reach', 'engagement', 'interaccion',
  'thruplay', 'thruplays', 'thruview', 'thruviews', 'trueview',
  'spotify', 'youtube', 'yt', 'ig', 'instagram', 'fb', 'facebook', 'tiktok',
  'perfil', 'profile', 'presave', 'gendem', 'evergreen',
  'clics', 'clicks', 'click', 'conversiones', 'conversion',
  'video', 'oficial', 'official', 'caliente', 'frio',
])

// Si un segmento queda SOLO con relleno, se descarta
const FILLER = new Set(['a', 'al', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'x', 'con', 'para', 'the'])

const VERSION_RE = /^v\d+$/   // V2, V3…
const PHASE_RE = /^f\d+$/     // F1, F2… (fases internas)

function norm(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type Project = { key: string; label: string }

export function deriveProject(campaignName: string, artist: Artist): Project {
  // 1. Fuera paréntesis y corchetes (casi siempre son tipo de campaña)
  const base = campaignName.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')

  // 2. Partir por separadores: |, ·, o guiones/slashes rodeados de espacio
  const segments = base.split(/\s*[|·]\s*|\s+[-–—/]\s+/)

  const artistNorms = [norm(artist.namePattern ?? ''), norm(artist.name)].filter(Boolean)

  const kept: string[] = []
  for (const seg of segments) {
    let n = norm(seg)
    if (!n) continue
    // Segmento que contiene al artista (incluye colabs "Big Soto x Knak") → fuera
    if (artistNorms.some((a) => n.includes(a))) continue
    // Frases de jerga
    for (const p of PHRASES) n = n.replace(new RegExp(`\\b${norm(p)}\\b`, 'g'), ' ')
    // Tokens de jerga / versión / fase
    const tokens = n.split(/\s+/).filter(
      (t) => t && !STOP_TOKENS.has(t) && !VERSION_RE.test(t) && !PHASE_RE.test(t)
    )
    if (!tokens.length) continue
    // Solo relleno ("al", "de"…) → fuera
    if (tokens.every((t) => FILLER.has(t))) continue
    kept.push(tokens.join(' '))
  }

  const key = kept.join(' ').replace(/\s+/g, ' ').trim()
  if (!key) return { key: '__general__', label: 'General' }

  const label = key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { key, label }
}
