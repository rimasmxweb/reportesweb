'use client'

import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

type Campaign = {
  id: string
  name: string
  platform: string
  youtube_type: string | null
  status: string
  budget_total: number | null
}

type Metric = {
  id: string
  date: string
  impressions: number
  total_spend: number
  ctr: number | null
  cpm: number | null
  frequency: number | null
  public_views: number
  thruviews: number
  engagements: number
  subscriber_conversions: number
  follow_on_view_conversions: number
  video_retention: number | null
  view_rate: number | null
  cost_per_view: number | null
  cost_per_conversion: number | null
  reach: number
  thruplay: number
  result_count: number
  cost_per_result: number | null
  campaigns: Campaign
}

const TABS = [
  { key: 'all',            label: 'Todo'    },
  { key: 'google_youtube', label: 'YouTube' },
  { key: 'meta',           label: 'Meta'    },
  { key: 'tiktok',         label: 'TikTok'  },
]

const REFRESH_MS = 15 * 60 * 1000
const C = { fontFamily: "'Barlow Condensed', sans-serif" }
const PLAT_LABEL: Record<string, string> = {
  google_youtube: 'YouTube',
  meta:           'Meta',
  tiktok:         'TikTok',
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('es-MX')
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${n.toFixed(2)}%`
}

function calcTrend(metrics: Metric[], getter: (m: Metric) => number): number | null {
  const byDate = new Map<string, number>()
  for (const m of metrics) {
    byDate.set(m.date, (byDate.get(m.date) ?? 0) + getter(m))
  }
  const daily = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
  if (daily.length < 4) return null
  const mid = Math.floor(daily.length / 2)
  const before = daily.slice(0, mid).reduce((a, b) => a + b, 0)
  const after  = daily.slice(mid).reduce((a, b) => a + b, 0)
  if (before === 0) return null
  return ((after - before) / before) * 100
}

function TrendPill({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-sm ${
        up ? 'bg-emerald-400/10 text-emerald-400' : 'bg-[#E8192C]/10 text-[#E8192C]'
      }`}
      style={C}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'Activa',     color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    ALERTA: { label: 'Alerta',     color: 'text-[#E8192C] bg-[#E8192C]/10 border-[#E8192C]/20'     },
    paused: { label: 'Pausada',    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'   },
    ended:  { label: 'Finalizada', color: 'text-[#444] bg-transparent border-[#2a2a2a]'             },
  }
  const s = map[status] ?? map.ended
  return (
    <span
      className={`text-[9px] px-2 py-0.5 rounded-sm border uppercase tracking-widest font-bold ${s.color}`}
      style={C}
    >
      {s.label}
    </span>
  )
}

function Sparkline({ data, id }: { data: { v: number }[]; id: string }) {
  if (data.length < 3) return null
  const gradId = `sg${id.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#E8192C" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#E8192C" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke="#E8192C"
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

type CampaignGroup = { campaign: Campaign; metrics: Metric[] }

function groupByCampaign(metrics: Metric[]): CampaignGroup[] {
  const map = new Map<string, CampaignGroup>()
  for (const m of metrics) {
    const id = m.campaigns?.id
    if (!id) continue
    if (!map.has(id)) map.set(id, { campaign: m.campaigns, metrics: [] })
    map.get(id)!.metrics.push(m)
  }
  return Array.from(map.values()).sort((a, b) => {
    const sa = a.metrics.reduce((s, m) => s + (m.total_spend ?? 0), 0)
    const sb = b.metrics.reduce((s, m) => s + (m.total_spend ?? 0), 0)
    return sb - sa
  })
}

function KpiCard({
  label, value, accent, trend,
}: {
  label: string; value: string; accent?: boolean; trend?: number | null
}) {
  return (
    <div className={`border rounded-sm p-5 flex flex-col gap-2 ${
      accent ? 'border-[#E8192C]/30 bg-[#E8192C]/5' : 'border-[#1a1a1a] bg-[#0a0a0a]'
    }`}>
      <p className="text-[#444] text-[10px] uppercase tracking-widest" style={C}>{label}</p>
      <p className={`text-3xl font-black leading-none ${accent ? 'text-[#E8192C]' : 'text-white'}`} style={C}>
        {value}
      </p>
      {trend !== undefined && <TrendPill pct={trend ?? null} />}
    </div>
  )
}

function CampaignRow({ group }: { group: CampaignGroup }) {
  const { campaign, metrics } = group
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date))
  const isYT = campaign.platform === 'google_youtube'

  const totalSpend       = sorted.reduce((s, m) => s + (m.total_spend  ?? 0), 0)
  const totalImpressions = sorted.reduce((s, m) => s + (m.impressions  ?? 0), 0)
  const totalThruviews   = sorted.reduce((s, m) => s + (m.thruviews    ?? 0), 0)
  const totalReach       = sorted.reduce((s, m) => s + (m.reach        ?? 0), 0)
  const totalThruplay    = sorted.reduce((s, m) => s + (m.thruplay     ?? 0), 0)

  const avgOf = (fn: (m: Metric) => number | null) => {
    const vals = sorted.map(fn).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const avgCTR       = avgOf(m => m.ctr)
  const avgCPM       = avgOf(m => m.cpm)
  const avgRetention = avgOf(m => m.video_retention)

  const spendTrend = (() => {
    const vals = sorted.map(m => m.total_spend ?? 0)
    if (vals.length < 4) return null
    const mid    = Math.floor(vals.length / 2)
    const before = vals.slice(0, mid).reduce((a, b) => a + b, 0)
    const after  = vals.slice(mid).reduce((a, b) => a + b, 0)
    if (before === 0) return null
    return ((after - before) / before) * 100
  })()

  const sparkData  = sorted.map(m => ({ v: m.total_spend ?? 0 }))
  const pctBudget  = campaign.budget_total && campaign.budget_total > 0
    ? Math.min(100, (totalSpend / campaign.budget_total) * 100)
    : null

  return (
    <div className="border border-[#1a1a1a] hover:border-[#252525] rounded-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="px-5 py-4 bg-[#0a0a0a] border-b border-[#141414] flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={campaign.status} />
            <span className="text-[#333] text-[9px] uppercase tracking-widest" style={C}>
              {PLAT_LABEL[campaign.platform] ?? campaign.platform}
              {campaign.youtube_type ? ` · ${campaign.youtube_type.replace(/_/g, ' ')}` : ''}
            </span>
          </div>
          <p className="text-white text-sm font-black uppercase tracking-wide leading-tight" style={C}>
            {campaign.name}
          </p>
          {pctBudget !== null && (
            <div className="mt-2 max-w-xs">
              <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E8192C] rounded-full"
                  style={{ width: `${pctBudget.toFixed(1)}%` }}
                />
              </div>
              <p className="text-[#333] text-[9px] mt-0.5" style={C}>
                {pctBudget.toFixed(0)}% del presupuesto usado
              </p>
            </div>
          )}
        </div>

        {/* Sparkline — gasto diario */}
        <div className="w-28 hidden md:block opacity-80">
          <Sparkline data={sparkData} id={campaign.id} />
        </div>

        {/* Total spend */}
        <div className="text-right shrink-0">
          <p className="text-[#E8192C] text-2xl font-black leading-none" style={C}>
            {fmtCurrency(totalSpend)}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <span className="text-[#333] text-[10px] uppercase tracking-wider" style={C}>invertido</span>
            {spendTrend !== null && <TrendPill pct={spendTrend} />}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-[#141414] bg-[#050505]">
        <MetricCell label="Vistas"       value={fmt(totalImpressions)} />
        <MetricCell label="% Clics"      value={fmtPct(avgCTR)}        />
        <MetricCell label="Costo x Mil"  value={fmtCurrency(avgCPM)}   />
        {isYT ? (
          <>
            <MetricCell label="Vistas Completas" value={fmt(totalThruviews)} />
            <MetricCell label="Retención"         value={fmtPct(avgRetention)} />
          </>
        ) : (
          <>
            <MetricCell label="Personas Únicas" value={fmt(totalReach)}   />
            <MetricCell label="Videos Vistos"   value={fmt(totalThruplay)} />
          </>
        )}
      </div>
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[#333] text-[9px] uppercase tracking-widest mb-1" style={C}>{label}</p>
      <p className="text-base font-black text-white" style={C}>{value}</p>
    </div>
  )
}

export default function MetricsDashboard({
  artistSlug,
  artistName,
}: {
  artistSlug: string
  artistName: string
}) {
  const [tab, setTab]           = useState('all')
  const [days, setDays]         = useState(7)
  const [metrics, setMetrics]   = useState<Metric[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    const platform = tab === 'all' ? '' : `&platform=${tab}`
    const res = await fetch(`/api/metrics/${artistSlug}?days=${days}${platform}`)
    if (res.ok) {
      const data = await res.json()
      setMetrics(data.metrics ?? [])
      setLastUpdated(new Date())
    }
    setLoading(false)
  }, [artistSlug, tab, days])

  useEffect(() => {
    setLoading(true)
    fetchMetrics()
    const interval = setInterval(fetchMetrics, REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const isYT     = tab === 'google_youtube'
  const isSocial = tab === 'meta' || tab === 'tiktok'

  const totals = {
    impressions: metrics.reduce((s, m) => s + (m.impressions  ?? 0), 0),
    spend:       metrics.reduce((s, m) => s + (m.total_spend  ?? 0), 0),
    reach:       metrics.reduce((s, m) => s + (m.reach        ?? 0), 0),
    views:       metrics.reduce((s, m) => s + (m.public_views ?? 0), 0),
    thruviews:   metrics.reduce((s, m) => s + (m.thruviews    ?? 0), 0),
    thruplay:    metrics.reduce((s, m) => s + (m.thruplay     ?? 0), 0),
    results:     metrics.reduce((s, m) => s + (m.result_count ?? 0), 0),
  }

  const kpis = isYT
    ? [
        { label: 'Vistas',            value: fmt(totals.impressions), trend: calcTrend(metrics, m => m.impressions ?? 0)  },
        { label: 'Invertido',         value: fmtCurrency(totals.spend), accent: true as const, trend: null                },
        { label: 'Vistas Completas',  value: fmt(totals.thruviews),  trend: calcTrend(metrics, m => m.thruviews ?? 0)    },
        { label: 'Vistas Públicas',   value: fmt(totals.views),      trend: null                                          },
      ]
    : isSocial
    ? [
        { label: 'Vistas',              value: fmt(totals.impressions), trend: calcTrend(metrics, m => m.impressions ?? 0) },
        { label: 'Invertido',           value: fmtCurrency(totals.spend), accent: true as const, trend: null               },
        { label: 'Personas Alcanzadas', value: fmt(totals.reach),      trend: calcTrend(metrics, m => m.reach ?? 0)       },
        { label: 'Videos Vistos',       value: fmt(totals.thruplay),   trend: calcTrend(metrics, m => m.thruplay ?? 0)    },
      ]
    : [
        { label: 'Vistas',              value: fmt(totals.impressions), trend: calcTrend(metrics, m => m.impressions ?? 0) },
        { label: 'Invertido',           value: fmtCurrency(totals.spend), accent: true as const, trend: null               },
        { label: 'Personas Alcanzadas', value: fmt(totals.reach),      trend: calcTrend(metrics, m => m.reach ?? 0)       },
        { label: 'Resultados',          value: fmt(totals.results),    trend: calcTrend(metrics, m => m.result_count ?? 0) },
      ]

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-0 border border-[#1a1a1a] rounded-sm overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 text-xs uppercase tracking-widest font-bold transition-colors ${
                tab === t.key
                  ? 'bg-[#E8192C] text-white'
                  : 'bg-transparent text-[#444] hover:text-white hover:bg-[#141414]'
              }`}
              style={C}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#666] uppercase tracking-widest rounded-sm px-3 py-2 focus:outline-none focus:border-[#E8192C] transition-colors"
            style={C}
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 3 meses</option>
            <option value={180}>Últimos 6 meses</option>
            <option value={365}>Todo el año</option>
          </select>
          {lastUpdated && (
            <span className="text-[#333] text-xs" style={C}>
              Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Campaign list */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-5 bg-[#E8192C]" />
          <h2 className="text-white text-xl font-black uppercase tracking-wide" style={C}>
            Campañas — {artistName}
          </h2>
        </div>

        {loading ? (
          <div className="border border-[#141414] rounded-sm p-16 text-center">
            <div className="inline-block w-5 h-5 border-2 border-[#E8192C] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#333] text-xs uppercase tracking-widest" style={C}>Cargando métricas...</p>
          </div>
        ) : metrics.length === 0 ? (
          <div className="border border-[#141414] rounded-sm p-16 text-center">
            <p className="text-[#333] text-xs uppercase tracking-widest" style={C}>Sin datos para este período</p>
            <p className="text-[#222] text-xs mt-2" style={C}>El agente actualizará próximamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupByCampaign(metrics).map((group) => (
              <CampaignRow key={group.campaign.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
