export function formatCount(value: number) {
  return Math.round(value).toLocaleString('es-MX')
}

export function formatMoney(value: number, currency: 'MXN' | 'USD', maxFraction = 2) {
  const amount = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFraction,
  }).format(value)
  return `$${amount} ${currency}`
}

export function formatCpv(value: number, currency: 'MXN' | 'USD') {
  const fractionDigits = value > 0 && value < 0.01 ? 4 : 2
  return formatMoney(value, currency, fractionDigits)
}

export function formatCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mill.`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil`
  }
  return Math.round(value).toLocaleString('es-MX')
}

export function formatDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatFullDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatStamp(prefix: string, iso: string | null, empty: string) {
  if (!iso) return empty
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return empty
  const text = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `${prefix}: ${text}`
}

export function mexicoToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
