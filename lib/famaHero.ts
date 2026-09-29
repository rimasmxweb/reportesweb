// Número grande de FAMA. Cambiar a mOY9EbMcgwg si se decide mostrar BTS.
export const FAMA_HERO_VIDEO_ID = 'LTSi_5UDWUE'

export function shortMexicoDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace(/\./g, '')
}

/** Días de calendario entre el inicio y hoy (America/Mexico_City, YYYY-MM-DD). */
export function campaignDayCount(campaignStart: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campaignStart) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const start = Date.parse(`${campaignStart}T00:00:00Z`)
  const end = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}
