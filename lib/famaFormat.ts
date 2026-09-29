export function formatCount(value: number) {
  return Math.round(value).toLocaleString('es-MX')
}

export function mexicoToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
