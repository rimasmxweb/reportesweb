const FX_URL = 'https://open.er-api.com/v6/latest/USD'
const CACHE_TTL_MS = 60 * 60 * 1000 // el tipo de cambio no cambia minuto a minuto

let cached: { rates: Record<string, number>; expiresAt: number } | null = null

export async function getFxRates(): Promise<Record<string, number>> {
  if (cached && cached.expiresAt > Date.now()) return cached.rates
  try {
    const res = await fetch(FX_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`FX API respondió ${res.status}`)
    const data = await res.json()
    const rates = data.rates ?? {}
    cached = { rates, expiresAt: Date.now() + CACHE_TTL_MS }
    return rates
  } catch (err) {
    console.error('[fx] no se pudo obtener el tipo de cambio, montos sin convertir:', err)
    return cached?.rates ?? {}
  }
}

export function toUsd(amount: number | null, currency: string, rates: Record<string, number>): number | null {
  if (amount == null) return null
  if (!currency || currency === 'USD') return amount
  const rate = rates[currency]
  if (!rate) return amount
  return amount / rate
}
