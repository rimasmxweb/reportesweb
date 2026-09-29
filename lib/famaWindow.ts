export type FamaRange = '7' | '14' | '30' | 'all'

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function windowForRange(range: FamaRange, campaignStart: string, today: string) {
  if (range === 'all') {
    const from = campaignStart <= today ? campaignStart : today
    const to = campaignStart <= today ? today : campaignStart
    return { from, to }
  }
  const span = Number(range)
  let from = addIsoDays(today, -(span - 1))
  if (from < campaignStart) from = campaignStart
  if (from > today) from = today
  return { from, to: today }
}
