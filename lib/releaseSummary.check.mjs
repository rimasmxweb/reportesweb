import { readFileSync } from 'node:fs'
import { summarizePaidMedia } from './releaseSummary.ts'

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const catalog = JSON.parse(readFileSync(new URL('./data/releases.json', import.meta.url), 'utf8'))
const yandel = catalog.releases
  .filter((release) => release.artistSlug === 'yandel' && release.active)
  .sort((a, b) => b.campaignStart.localeCompare(a.campaignStart))

assert(yandel[0]?.slug === 'cual-es-la-necesidad', 'el hero debe ser Cuál es la necesidad')
assert(yandel.every((release) => release.publicYoutubeViews == null), 'las vistas públicas no se inventan')
assert(catalog.releases.find((release) => release.slug === 'dnd')?.active === true, 'DND sigue en el catálogo')

const summary = summarizePaidMedia([
  {
    date: '2026-09-03',
    impressions: 100,
    total_spend: 10,
    thruviews: 40,
    thruplay: 7,
    public_views: 999999,
    campaigns: { platform: 'google_youtube' },
  },
  {
    date: '2026-09-04',
    impressions: 50,
    total_spend: 5,
    thruviews: 0,
    thruplay: 20,
    campaigns: { platform: 'tiktok' },
  },
  {
    date: '2026-09-04',
    impressions: 10,
    total_spend: 2,
    thruviews: 3,
    thruplay: 0,
    campaigns: { platform: 'meta' },
  },
])

assert(summary.platforms[0].plays === 40, 'YouTube cuenta reproducciones pagadas, no vistas públicas')
assert(summary.platforms[0].cpvUsd === 10 / 40, 'costo por vista de YouTube')
assert(summary.platforms[1].plays === 20, 'TikTok cuenta reproducciones')
assert(summary.platforms[1].playsLabel === 'Reproducciones', 'TikTok no usa jerga de compra')
assert(summary.platforms[2].hasRows === true, 'Meta con filas cuenta como plataforma con datos')
assert(summary.platforms[2].plays === 0, 'Meta no usa las vistas de YouTube')
assert(summary.platforms[2].cpvUsd == null, 'sin reproducciones no hay costo por vista')
assert(summary.spendUsd === 17, 'el gasto suma las tres plataformas')
assert(summary.daily.length === 2, 'la serie diaria solo tiene días con filas')

const empty = summarizePaidMedia([])
assert(empty.hasRows === false, 'sin filas no hay pauta')
assert(empty.platforms.every((platform) => platform.cpvUsd == null), 'sin filas no hay costo por vista')

console.log('releaseSummary: catálogo y pauta ok')
