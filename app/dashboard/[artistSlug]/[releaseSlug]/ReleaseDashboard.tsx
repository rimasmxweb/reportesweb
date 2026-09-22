'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import LaserBar from '../../../components/LaserBar'

type Metric = {
  id: string
  date: string
  impressions: number
  total_spend: number
  public_views: number
  thruviews: number
  thruplay: number
  campaigns: {
    id: string
    name: string
    platform: string
    status: string
  }
}

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

const PLAT_LABEL: Record<string, string> = {
  google_youtube: 'YouTube',
  meta: 'Meta',
  tiktok: 'TikTok',
}

const PLAT_COLOR: Record<string, string> = {
  google_youtube: '#FF0000',
  meta: '#1877F2',
  tiktok: '#111827',
}

const PERIODS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: 'Año' },
]

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString('es-MX')
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCurrencyShort(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}

function fmtDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function playsOf(metric: Metric): number {
  const platform = metric.campaigns?.platform
  if (platform === 'google_youtube') {
    if ((metric.public_views ?? 0) > 0) return metric.public_views
    return metric.thruviews ?? 0
  }
  if ((metric.thruplay ?? 0) > 0) return metric.thruplay
  if ((metric.public_views ?? 0) > 0) return metric.public_views
  return metric.thruviews ?? 0
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  if (accent) {
    return (
      <div
        className="rounded-[20px] p-5 sm:p-6 text-white flex flex-col gap-2"
        style={{ background: 'var(--grad-encendido)', boxShadow: 'var(--shadow-red-glow)' }}
      >
        <p className="text-white/70 text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>{label}</p>
        <p className="text-4xl sm:text-5xl font-extrabold tabular-nums leading-none" style={C}>{value}</p>
        {hint && <p className="text-white/75 text-xs">{hint}</p>}
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)] flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9b9ba3]" style={C}>{label}</p>
      <p className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-none text-[#0a0a0b]" style={C}>{value}</p>
      {hint && <p className="text-[#9b9ba3] text-xs">{hint}</p>}
    </div>
  )
}

export default function ReleaseDashboard({
  artistSlug,
  artistName,
  releaseSlug,
  releaseTitle,
}: {
  artistSlug: string
  artistName: string
  releaseSlug: string
  releaseTitle: string
}) {
  const [days, setDays] = useState(30)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const url = `/api/metrics/${artistSlug}?days=${days}&release=${encodeURIComponent(releaseSlug)}`

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error('metrics')
        return res.json() as Promise<{ metrics?: Metric[] }>
      })
      .then((data) => {
        if (cancelled) return
        setError(false)
        setMetrics(data.metrics ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setMetrics([])
      })
      .finally(() => {
        if (cancelled) return
        setFetching(false)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [artistSlug, releaseSlug, days])

  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, metric) => {
        acc.spend += metric.total_spend ?? 0
        acc.impressions += metric.impressions ?? 0
        acc.plays += playsOf(metric)
        return acc
      },
      { spend: 0, impressions: 0, plays: 0 },
    )
  }, [metrics])

  const byPlatform = useMemo(() => {
    const map = new Map<string, { platform: string; spend: number; impressions: number; plays: number }>()
    for (const metric of metrics) {
      const platform = metric.campaigns?.platform
      if (!platform) continue
      if (!map.has(platform)) map.set(platform, { platform, spend: 0, impressions: 0, plays: 0 })
      const row = map.get(platform)!
      row.spend += metric.total_spend ?? 0
      row.impressions += metric.impressions ?? 0
      row.plays += playsOf(metric)
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend || b.impressions - a.impressions)
  }, [metrics])

  const campaigns = useMemo(() => {
    const map = new Map<string, {
      id: string
      name: string
      platform: string
      status: string
      spend: number
      impressions: number
      plays: number
    }>()
    for (const metric of metrics) {
      const campaign = metric.campaigns
      if (!campaign?.id) continue
      if (!map.has(campaign.id)) {
        map.set(campaign.id, {
          id: campaign.id,
          name: campaign.name,
          platform: campaign.platform,
          status: campaign.status,
          spend: 0,
          impressions: 0,
          plays: 0,
        })
      }
      const row = map.get(campaign.id)!
      row.spend += metric.total_spend ?? 0
      row.impressions += metric.impressions ?? 0
      row.plays += playsOf(metric)
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend)
  }, [metrics])

  const daily = useMemo(() => {
    const map = new Map<string, number>()
    for (const metric of metrics) map.set(metric.date, (map.get(metric.date) ?? 0) + (metric.total_spend ?? 0))
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, spend]) => ({ date, label: fmtDay(date), spend }))
  }, [metrics])

  const chartKey = byPlatform.some((row) => row.spend > 0) ? 'spend' : 'impressions'
  const chartRows = byPlatform
    .map((row) => ({
      name: PLAT_LABEL[row.platform] ?? row.platform,
      platform: row.platform,
      value: chartKey === 'spend' ? row.spend : row.impressions,
    }))
    .filter((row) => row.value > 0)

  const periodLabel = PERIODS.find((period) => period.days === days)?.label ?? `${days} días`

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-7">
      <LaserBar loading={fetching} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>
            {artistName} · {periodLabel}
          </p>
          <h2 className="text-[#0a0a0b] text-2xl font-extrabold uppercase tracking-wide" style={C}>
            Resultados
          </h2>
        </div>
        <div className="flex bg-white border border-[#e6e6e8] rounded-full p-1 shadow-[var(--shadow-card)]">
          {PERIODS.map((period) => {
            const active = days === period.days
            return (
              <button
                key={period.days}
                type="button"
                onClick={() => {
                  if (period.days === days) return
                  setLoading(true)
                  setFetching(true)
                  setDays(period.days)
                }}
                className={`rounded-full px-3 sm:px-4 py-2 text-xs uppercase tracking-widest font-bold ${
                  active ? 'text-white' : 'text-[#9b9ba3] hover:text-[#0a0a0b]'
                }`}
                style={{
                  ...C,
                  ...(active ? { background: 'var(--grad-encendido)', boxShadow: 'var(--shadow-red-glow)' } : {}),
                }}
              >
                {period.label}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="border border-[#e6e6e8] bg-white rounded-2xl p-12 text-center shadow-[var(--shadow-card)]">
          <p className="text-[#5b5b63] text-xs uppercase tracking-widest" style={C}>No se pudieron cargar las métricas</p>
          <p className="text-[#c4c4c8] text-xs mt-2" style={C}>Vuelve a intentar en unos minutos</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="border border-[#e6e6e8] bg-white rounded-2xl p-5 h-28 shadow-[var(--shadow-card)]" />
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <div className="border border-[#e6e6e8] bg-white rounded-2xl p-12 sm:p-16 text-center shadow-[var(--shadow-card)]">
          <p className="text-[#0a0a0b] text-sm uppercase tracking-widest font-bold" style={C}>
            Sin campañas para este release
          </p>
          <p className="text-[#5b5b63] text-sm mt-3 max-w-md mx-auto">
            No hay filas sincronizadas de {artistName} cuyo nombre mencione «{releaseTitle}» en este período.
            El release ya está en el catálogo; los números aparecen cuando hay campañas con ese título.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi label="Invertido" value={fmtCurrencyShort(totals.spend)} hint={fmtCurrency(totals.spend)} accent />
            <Kpi label="Impresiones" value={fmt(totals.impressions)} />
            <Kpi
              label="Reproducciones"
              value={fmt(totals.plays)}
              hint="Vistas públicas, ThruViews o ThruPlay"
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <h3 className="text-[#0a0a0b] text-sm font-bold uppercase tracking-wide" style={C}>Por plataforma</h3>
              <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold mt-0.5 mb-4" style={C}>
                {chartKey === 'spend' ? 'Inversión' : 'Impresiones'}
              </p>
              {chartRows.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(120, chartRows.length * 48)}>
                  <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={84}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#5b5b63' }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18} isAnimationActive={false}>
                      {chartRows.map((row) => (
                        <Cell key={row.platform} fill={PLAT_COLOR[row.platform] ?? '#E8192C'} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(value) => {
                          const n = Number(value)
                          if (!Number.isFinite(n)) return ''
                          return chartKey === 'spend' ? fmtCurrencyShort(n) : fmt(n)
                        }}
                        style={{ fontSize: 12, fontWeight: 800, fill: '#0a0a0b', fontFamily: "'Barlow Condensed', sans-serif" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-[#9b9ba3] text-xs uppercase tracking-widest" style={C}>Sin inversión ni impresiones en el período</p>
              )}
              <ul className="mt-4 divide-y divide-[#f0f0f1] border-t border-[#f0f0f1]">
                <li className="grid grid-cols-4 gap-2 pt-3 text-[10px] uppercase tracking-[0.14em] font-bold text-[#9b9ba3]" style={C}>
                  <span>Plataforma</span>
                  <span className="text-right">Invertido</span>
                  <span className="text-right">Impresiones</span>
                  <span className="text-right">Repro.</span>
                </li>
                {byPlatform.map((row) => (
                  <li key={row.platform} className="grid grid-cols-4 gap-2 py-3 text-sm">
                    <span className="font-bold uppercase tracking-wide text-[#0a0a0b]" style={C}>
                      {PLAT_LABEL[row.platform] ?? row.platform}
                    </span>
                    <span className="text-right tabular-nums text-[#5b5b63]" style={C}>{fmtCurrencyShort(row.spend)}</span>
                    <span className="text-right tabular-nums text-[#5b5b63]" style={C}>{fmt(row.impressions)}</span>
                    <span className="text-right tabular-nums text-[#0a0a0b] font-bold" style={C}>{fmt(row.plays)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[#9b9ba3] text-[10px] mt-2" style={C}>
                Columnas: invertido, impresiones, reproducciones. YouTube usa vistas públicas o ThruViews; Meta y otras, ThruPlay.
              </p>
            </div>

            <div className="bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <h3 className="text-[#0a0a0b] text-sm font-bold uppercase tracking-wide" style={C}>Inversión por día</h3>
              <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold mt-0.5 mb-4" style={C}>
                Campañas que coinciden con el release
              </p>
              {daily.length >= 2 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="releaseSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E8192C" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#E8192C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 11, fill: '#9b9ba3' }}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value) => [fmtCurrency(Number(value)), 'Invertido']}
                      contentStyle={{ borderRadius: 12, borderColor: '#e6e6e8', fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="#E8192C"
                      strokeWidth={2}
                      fill="url(#releaseSpend)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-[#9b9ba3] text-xs uppercase tracking-widest py-10 text-center" style={C}>
                  Hace falta más de un día con datos para la curva
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[#0a0a0b] text-2xl font-extrabold uppercase tracking-wide mb-4" style={C}>
              Campañas <span className="text-[#9b9ba3] text-base font-bold">{campaigns.length}</span>
            </h3>
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="bg-white border border-[#e6e6e8] rounded-2xl px-5 py-4 shadow-[var(--shadow-card)] flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>
                      {PLAT_LABEL[campaign.platform] ?? campaign.platform}
                    </p>
                    <p className="text-[#0a0a0b] text-sm font-bold uppercase tracking-wide truncate" style={C}>{campaign.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-extrabold tabular-nums leading-none text-[#0a0a0b]" style={C}>{fmtCurrencyShort(campaign.spend)}</p>
                    <p className="text-[#9b9ba3] text-[10px] uppercase tracking-wider mt-1" style={C}>
                      {fmt(campaign.impressions)} imp. · {fmt(campaign.plays)} repro.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
