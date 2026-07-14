'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AreaChart, Area, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, LabelList,
} from 'recharts'
import LaserBar from '../../components/LaserBar'

type Campaign = {
  id: string
  name: string
  platform: string
  youtube_type: string | null
  status: string
  budget_total: number | null
  project: string
  projectKey: string
}

type ProjectSummary = { key: string; label: string; spend: number }

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
  raw_data: string | null
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
  google_youtube: 'YouTube', meta: 'Meta', tiktok: 'TikTok',
}
const PLAT_COLOR: Record<string, string> = {
  google_youtube: '#FF0000', meta: '#1877F2', tiktok: '#111827',
}
const PERIOD_LABEL: Record<number, string> = {
  7: 'Últimos 7 días', 14: 'Últimos 14 días', 30: 'Últimos 30 días',
  90: 'Últimos 3 meses', 180: 'Últimos 6 meses', 365: 'Todo el año',
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString('es-MX')
}
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtCurrencyShort(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n)}`
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${n.toFixed(2)}%`
}

// '2026-07-10' → '10 jul 2026' sin corrimiento de zona horaria
function fmtDateEs(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_CSV: Record<string, string> = {
  active: 'Activa', paused: 'Pausada', ended: 'Finalizada', ALERTA: 'Alerta',
}

function slugify(s: string) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// BOM UTF-8 para que Excel abra acentos correctamente
function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = '\uFEFF' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function dailyTotals(metrics: Metric[], getter: (m: Metric) => number): [string, number][] {
  const byDate = new Map<string, number>()
  for (const m of metrics) byDate.set(m.date, (byDate.get(m.date) ?? 0) + getter(m))
  return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function calcTrend(metrics: Metric[], getter: (m: Metric) => number): number | null {
  const daily = dailyTotals(metrics, getter).map(([, v]) => v)
  if (daily.length < 4) return null
  const mid = Math.floor(daily.length / 2)
  const before = daily.slice(0, mid).reduce((a, b) => a + b, 0)
  const after = daily.slice(mid).reduce((a, b) => a + b, 0)
  if (before === 0) return null
  return ((after - before) / before) * 100
}

// Sellos de gira: RÉCORD si el mejor día cae al final del período; EN RACHA si la tendencia ≥ +25%.
// Solo con suficientes días de datos para que el sello signifique algo.
function computeStamp(metrics: Metric[], getter: (m: Metric) => number, trend: number | null): string | null {
  const series = dailyTotals(metrics, getter)
  if (series.length < 6) return null
  let maxIdx = 0
  series.forEach(([, v], i) => { if (v > series[maxIdx][1]) maxIdx = i })
  if (series[maxIdx][1] > 0 && maxIdx >= series.length - 2) return 'RÉCORD'
  if (trend != null && trend >= 25) return 'EN RACHA 🔥'
  return null
}

function TrendPill({ pct, light }: { pct: number | null; light?: boolean }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
        light
          ? 'bg-white/15 text-white backdrop-blur-sm'
          : up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[#E8192C]'
      }`}
      style={C}
    >
      {up ? (
        <span style={{ animation: 'nudge-up 1.8s ease-in-out infinite', display: 'inline-block' }}>▲</span>
      ) : (
        '▼'
      )}{' '}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Activa',     cls: 'text-green-700 bg-green-50 border-green-200' },
    ALERTA: { label: 'Alerta',     cls: 'text-[#E8192C] bg-red-50 border-red-200' },
    paused: { label: 'Pausada',    cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    ended:  { label: 'Finalizada', cls: 'text-[#9b9ba3] bg-[#f4f4f5] border-[#e6e6e8]' },
  }
  const s = map[status] ?? map.ended
  return (
    <span className={`inline-flex items-center text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-widest font-bold ${s.cls}`} style={C}>
      {status === 'active' && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block mr-1"
          style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
        />
      )}
      {s.label}
    </span>
  )
}

function ProjectChips({
  projects, selected, onSelect, globalSpend,
}: {
  projects: ProjectSummary[]; selected: string; onSelect: (key: string) => void; globalSpend: number
}) {
  const chip = (active: boolean) =>
    `snap-start shrink-0 h-9 inline-flex items-center px-4 rounded-full text-xs uppercase tracking-widest font-bold ${
      active
        ? 'text-white border border-transparent scale-[1.04]'
        : 'bg-white text-[#5b5b63] border border-[#e6e6e8] hover:border-[#E8192C]/40 hover:text-[#0a0a0b]'
    }`
  const chipStyle = (active: boolean): React.CSSProperties => ({
    ...C,
    transition: 'all 250ms var(--ease-snap)',
    ...(active ? { background: 'var(--grad-encendido)', boxShadow: 'var(--shadow-red-glow)' } : {}),
  })
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 rail-fade snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
      <span className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold shrink-0 mr-1" style={C}>
        Proyecto
      </span>
      <button onClick={() => onSelect('all')} className={chip(selected === 'all')} style={chipStyle(selected === 'all')}>
        Global <span className="opacity-70 ml-1">· {fmtCurrencyShort(globalSpend)}</span>
      </button>
      {projects.map((p) => (
        <button key={p.key} onClick={() => onSelect(p.key)} className={chip(selected === p.key)} style={chipStyle(selected === p.key)}>
          {p.label} <span className="opacity-70 ml-1">· {fmtCurrencyShort(p.spend)}</span>
        </button>
      ))}
    </div>
  )
}

function Sep() {
  return <span className="text-[#E8192C]">✦</span>
}

// Cinta de estadio: los highlights del período como ticker LED
function HypeTicker({
  impressions, spend, activeCount, topProject,
}: {
  impressions: number; spend: number; activeCount: number; topProject: ProjectSummary | null
}) {
  return (
    <div className="bg-[#0a0a0b] h-9 rounded-lg overflow-hidden relative rail-fade flex items-center">
      <div
        className="flex whitespace-nowrap w-max will-change-transform"
        style={{ animation: 'ticker 32s linear infinite' }}
        onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = 'paused' }}
        onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = 'running' }}
      >
        {[0, 1].map((i) => (
          <span key={i} className="flex items-center gap-3 pr-3 text-white text-xs uppercase tracking-[0.18em] font-bold" style={C}>
            <span>▲ {fmt(impressions)} vistas este período</span><Sep />
            <span>{fmtCurrencyShort(spend)} invertidos</span><Sep />
            <span>{activeCount} campañas activas</span><Sep />
            {topProject && <><span>Top: {topProject.label} {fmtCurrencyShort(topProject.spend)}</span><Sep /></>}
          </span>
        ))}
      </div>
    </div>
  )
}

function ExportMenu({
  disabled, onSummary, onDaily,
}: {
  disabled: boolean; onSummary: () => void; onDaily: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="h-[38px] inline-flex items-center gap-1.5 bg-white border border-[#e6e6e8] rounded-xl px-3 sm:px-4 text-xs text-[#5b5b63] uppercase tracking-widest font-bold hover:text-[#0a0a0b] hover:border-[#E8192C]/40 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[var(--shadow-card)]"
        style={C}
      >
        <span className="text-[#E8192C]">⬇</span>
        <span className="hidden sm:inline">Descargar</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 bg-white border border-[#e6e6e8] rounded-xl shadow-[var(--shadow-lift)] p-1.5 w-64 animate-rise">
            <p className="text-[#9b9ba3] text-[9px] uppercase tracking-[0.18em] font-bold px-2.5 pt-1.5 pb-1" style={C}>
              Reporte de lo que estás viendo
            </p>
            <button
              onClick={() => { onSummary(); setOpen(false) }}
              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-[#0a0a0b] hover:bg-[#f4f4f5] transition-colors"
              style={C}
            >
              Resumen por campaña <span className="text-[#9b9ba3]">· CSV</span>
            </button>
            <button
              onClick={() => { onDaily(); setOpen(false) }}
              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-[#0a0a0b] hover:bg-[#f4f4f5] transition-colors"
              style={C}
            >
              Detalle día por día <span className="text-[#9b9ba3]">· CSV</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-8 shrink-0 rounded-full" style={{ background: 'var(--grad-encendido-h)' }} />
      <div className="leading-none">
        <h2 className="text-[#0a0a0b] text-2xl font-extrabold uppercase tracking-wide" style={C}>{title}</h2>
        {subtitle && <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold mt-1.5" style={C}>{subtitle}</p>}
      </div>
    </div>
  )
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDone(false)
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      setDone(true)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setVal(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else { setVal(target); setDone(true) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return { val, done }
}

function Stamp({ label }: { label: string }) {
  return (
    <span
      className="animate-stamp absolute -top-2 -right-2 bg-[#0a0a0b] text-white text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border-2 border-[#E8192C] shadow-[var(--shadow-red-glow)] z-10"
      style={{ ...C, animationDelay: '850ms' }}
    >
      {label}
    </span>
  )
}

function KpiCard({ label, value, format, accent, trend, subline, stamp, stagger }: {
  label: string; value: number; format: 'number' | 'currency'; accent?: boolean
  trend?: number | null; subline?: string; stamp?: string | null; stagger?: number
}) {
  const { val: animated, done } = useCountUp(value)
  const display = format === 'currency' ? fmtCurrencyShort(animated) : fmt(animated)
  const hot = !accent && trend != null && trend >= 25

  if (accent) {
    return (
      <div
        className="col-span-2 order-first sm:col-span-1 relative rounded-[20px] p-5 sm:p-6 text-white flex flex-col gap-2 animate-rise"
        style={{
          background: 'var(--grad-encendido)',
          boxShadow: 'var(--shadow-red-glow)',
          '--stagger': stagger ?? 0,
        } as React.CSSProperties}
      >
        {stamp && <Stamp label={stamp} />}
        <p className="text-white/70 text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>{label}</p>
        <p className={`text-4xl sm:text-6xl font-extrabold tabular-nums leading-none ${done ? 'kpi-pop' : ''}`} style={C}>
          {display}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {trend != null && <TrendPill pct={trend} light />}
          {subline && <p className="text-white/75 text-xs">{subline}</p>}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-2 animate-rise"
      style={{ '--stagger': stagger ?? 0 } as React.CSSProperties}
    >
      {stamp && <Stamp label={stamp} />}
      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9b9ba3]" style={C}>{label}</p>
      <p
        className={`text-3xl sm:text-4xl font-extrabold tabular-nums leading-none ${done ? 'kpi-pop' : ''} ${hot ? '' : 'text-[#0a0a0b]'}`}
        style={hot
          ? { ...C, background: 'var(--grad-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
          : C}
      >
        {display}
      </p>
      {trend !== undefined && <TrendPill pct={trend ?? null} />}
    </div>
  )
}

function SkeletonKpi() {
  return (
    <div className="border border-[#e6e6e8] bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-[var(--shadow-card)]">
      <div className="h-2.5 w-20 skeleton" />
      <div className="h-8 w-28 skeleton" />
      <div className="h-3 w-12 skeleton" />
    </div>
  )
}
function SkeletonRow() {
  return (
    <div className="border border-[#e6e6e8] bg-white rounded-2xl p-4 flex items-center gap-4 shadow-[var(--shadow-card)]">
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-24 skeleton" />
        <div className="h-4 w-56 skeleton" />
      </div>
      <div className="h-6 w-24 skeleton" />
    </div>
  )
}

function Sparkline({ data }: { data: { v: number }[] }) {
  if (data.length < 3) return null
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8192C" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#E8192C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke="#E8192C" strokeWidth={2} fill="url(#gSpark)" dot={false} isAnimationActive={false} />
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

function spendByPlatform(metrics: Metric[]) {
  const map = new Map<string, number>()
  for (const m of metrics) {
    const p = m.campaigns?.platform
    if (!p) continue
    map.set(p, (map.get(p) ?? 0) + (m.total_spend ?? 0))
  }
  return Array.from(map.entries())
    .map(([platform, value]) => ({ platform, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

// Embudo de audiencia para YouTube, usando columnas confiables.
// Impresiones → Reproducciones (ThruViews) → Vieron completo (impresiones × retención).
function retentionFunnel(metrics: Metric[]) {
  let impr = 0, views = 0, completed = 0
  for (const m of metrics) {
    if (m.campaigns?.platform !== 'google_youtube') continue
    const i = m.impressions ?? 0
    impr += i
    views += m.thruviews ?? 0
    if (m.video_retention != null && i > 0) completed += i * (m.video_retention / 100)
  }
  if (impr <= 0) return null
  const base = Math.max(impr, views)
  return [
    { label: 'Impresiones',     count: impr,      pct: (impr / base) * 100 },
    { label: 'Reproducciones',  count: views,     pct: (views / base) * 100 },
    { label: 'Vieron completo', count: completed, pct: (completed / base) * 100 },
  ]
}

function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)] ${className}`}>
      <div className="mb-4">
        <h3 className="text-[#0a0a0b] text-sm font-bold uppercase tracking-wide" style={C}>{title}</h3>
        {subtitle && <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold mt-0.5" style={C}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const PLAT_GRAD_CSS: Record<string, string> = {
  google_youtube: 'var(--grad-yt)',
  meta: 'var(--grad-meta)',
  tiktok: 'var(--grad-tiktok)',
}

function PlatformDonut({ data, total }: { data: { platform: string; value: number }[]; total: number }) {
  return (
    <div>
      <div className="relative" style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="platform" innerRadius={56} outerRadius={84} paddingAngle={3} cornerRadius={6} stroke="none">
              {data.map((d) => <Cell key={d.platform} fill={PLAT_COLOR[d.platform] ?? '#999'} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-[#9b9ba3]" style={C}>Total</span>
          <span
            className="text-2xl font-extrabold tabular-nums"
            style={{ ...C, background: 'var(--grad-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {fmtCurrencyShort(total)}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 mt-4">
        {data.map((d, index) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={d.platform}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#5b5b63]" style={C}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PLAT_COLOR[d.platform] ?? '#999' }} />
                  {PLAT_LABEL[d.platform] ?? d.platform}
                </span>
                <span className="font-bold text-[#0a0a0b] tabular-nums" style={C}>
                  {fmtCurrencyShort(d.value)} · {pct}%
                </span>
              </div>
              <div
                className="h-1 rounded-full mt-1 animate-grow"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: PLAT_GRAD_CSS[d.platform] ?? 'var(--grad-encendido-h)',
                  '--i': index,
                } as React.CSSProperties}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

type BarDatum = { key?: string; name: string; value: number; platform: string }

const BAR_GRAD: Record<string, string> = {
  google_youtube: 'url(#gYt)',
  meta: 'url(#gMeta)',
  tiktok: 'url(#gTiktok)',
}

function CampaignBars({ data, onBarClick }: { data: BarDatum[]; onBarClick?: (d: BarDatum) => void }) {
  const height = Math.max(140, data.length * 42 + 16)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gYt" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FF0000" /><stop offset="100%" stopColor="#FF5A3C" /></linearGradient>
          <linearGradient id="gMeta" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#1877F2" /><stop offset="100%" stopColor="#41B0FF" /></linearGradient>
          <linearGradient id="gTiktok" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#0a0a0b" /><stop offset="100%" stopColor="#2E2E38" /></linearGradient>
          <linearGradient id="gRimas" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#E8192C" /><stop offset="100%" stopColor="#FF5A3C" /></linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          type="category" dataKey="name" width={118} axisLine={false} tickLine={false}
          tick={{ fontSize: 11, fill: '#5b5b63' }}
          tickFormatter={(v: string) => (v.length > 15 ? v.slice(0, 14) + '…' : v)}
        />
        <Bar
          dataKey="value" radius={[0, 8, 8, 0]} barSize={20} isAnimationActive={false}
          onClick={onBarClick ? (_: unknown, index: number) => onBarClick(data[index]) : undefined}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={BAR_GRAD[d.platform] ?? 'url(#gRimas)'} style={{ cursor: onBarClick ? 'pointer' : 'default' }} />
          ))}
          <LabelList dataKey="value" position="right"
            formatter={(v) => { const n = Number(v); return Number.isFinite(n) ? fmtCurrencyShort(n) : '' }}
            style={{ fontSize: 12, fontWeight: 800, fill: '#0a0a0b', fontFamily: "'Barlow Condensed', sans-serif" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RetentionFunnel({ stages }: { stages: { label: string; count: number; pct: number }[] }) {
  const top = stages[0]?.count || 1
  return (
    <div className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const w = Math.max(4, Math.min(100, s.pct))
        const share = Math.round((s.count / top) * 100)
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#5b5b63]" style={C}>{s.label}</span>
              <span className="text-lg font-extrabold text-[#0a0a0b] tabular-nums leading-none" style={C}>
                {fmt(s.count)} <span className="text-[#9b9ba3] font-bold text-sm">· {share}%</span>
              </span>
            </div>
            <div className="h-4 bg-[#f0f0f1] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full animate-grow sweep-once"
                style={{
                  width: `${w}%`,
                  background: `var(--grad-funnel-${i + 1})`,
                  '--i': i,
                } as React.CSSProperties}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CampaignRow({ group, index = 0 }: { group: CampaignGroup; index?: number }) {
  const { campaign, metrics } = group
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date))
  const isYT = campaign.platform === 'google_youtube'

  const totalSpend = sorted.reduce((s, m) => s + (m.total_spend ?? 0), 0)
  const totalImpressions = sorted.reduce((s, m) => s + (m.impressions ?? 0), 0)
  const totalThruviews = sorted.reduce((s, m) => s + (m.thruviews ?? 0), 0)
  const totalReach = sorted.reduce((s, m) => s + (m.reach ?? 0), 0)
  const totalThruplay = sorted.reduce((s, m) => s + (m.thruplay ?? 0), 0)

  const avgOf = (fn: (m: Metric) => number | null) => {
    const vals = sorted.map(fn).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const avgCTR = avgOf((m) => m.ctr)
  const avgRetention = avgOf((m) => m.video_retention)

  const spendTrend = (() => {
    const vals = sorted.map((m) => m.total_spend ?? 0)
    if (vals.length < 4) return null
    const mid = Math.floor(vals.length / 2)
    const before = vals.slice(0, mid).reduce((a, b) => a + b, 0)
    const after = vals.slice(mid).reduce((a, b) => a + b, 0)
    if (before === 0) return null
    return ((after - before) / before) * 100
  })()

  const sparkData = sorted.map((m) => ({ v: m.total_spend ?? 0 }))
  const pctBudget = campaign.budget_total && campaign.budget_total > 0
    ? Math.min(100, (totalSpend / campaign.budget_total) * 100) : null
  const ended = campaign.status === 'ended'

  const rectaFinal = pctBudget !== null && pctBudget >= 90

  return (
    <div
      className={`relative bg-white border border-[#e6e6e8] rounded-2xl overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)] transition-shadow duration-300 animate-rise ${ended ? 'opacity-70' : ''}`}
      style={{ '--stagger': Math.min(index, 8) } as React.CSSProperties}
    >
      {/* Franja de identidad de plataforma */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${ended ? 'saturate-50' : ''}`}
        style={{ background: PLAT_GRAD_CSS[campaign.platform] ?? 'var(--grad-encendido-h)' }}
      />

      <div className="pl-5 pr-4 sm:pr-5 py-4 flex items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={campaign.status} />
            <span className="text-[#9b9ba3] text-[9px] uppercase tracking-[0.18em] font-bold truncate" style={C}>
              {PLAT_LABEL[campaign.platform] ?? campaign.platform}
              {campaign.youtube_type ? ` · ${campaign.youtube_type.replace(/_/g, ' ')}` : ''}
            </span>
          </div>
          <p className="text-[#0a0a0b] text-sm font-bold uppercase tracking-wide leading-tight" style={C}>{campaign.name}</p>
          {pctBudget !== null && (
            <div className="mt-2 max-w-xs">
              <div className="h-1.5 bg-[#f0f0f1] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full animate-grow ${rectaFinal ? 'sweep-once sweep-loop' : ''}`}
                  style={{ width: `${pctBudget.toFixed(1)}%`, background: 'var(--grad-encendido-h)' }}
                />
              </div>
              <p className={`text-[9px] mt-0.5 ${rectaFinal ? 'text-[#E8192C] font-bold' : 'text-[#9b9ba3]'}`} style={C}>
                {rectaFinal ? `Recta final · ${pctBudget.toFixed(0)}%` : `${pctBudget.toFixed(0)}% del presupuesto usado`}
              </p>
            </div>
          )}
        </div>

        <div className="w-28 hidden md:block">
          <Sparkline data={sparkData} />
        </div>

        <div className="text-right shrink-0">
          <p
            className={`text-2xl sm:text-3xl font-extrabold leading-none tabular-nums ${ended ? 'text-[#9b9ba3]' : ''}`}
            style={ended
              ? C
              : { ...C, background: 'var(--grad-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {fmtCurrencyShort(totalSpend)}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <span className="text-[#9b9ba3] text-[10px] uppercase tracking-wider" style={C}>invertido</span>
            {spendTrend !== null && <TrendPill pct={spendTrend} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-[#f0f0f1] border-t border-[#f0f0f1] bg-[#fafafa]">
        <MetricCell label="Vistas" value={fmt(totalImpressions)} />
        <MetricCell label="% Clics" value={fmtPct(avgCTR)} />
        <MetricCell label="Costo total" value={fmtCurrencyShort(totalSpend)} />
        {isYT ? (
          <>
            <MetricCell label="Vistas Completas" value={fmt(totalThruviews)} />
            <MetricCell label="Retención" value={fmtPct(avgRetention)} />
          </>
        ) : (
          <>
            <MetricCell label="Personas Únicas" value={fmt(totalReach)} />
            <MetricCell label="Videos Vistos" value={fmt(totalThruplay)} />
          </>
        )}
      </div>
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={C}>{label}</p>
      <p className="text-lg font-extrabold text-[#0a0a0b] tabular-nums leading-none" style={C}>{value}</p>
    </div>
  )
}

export default function MetricsDashboard({ artistSlug, artistName }: { artistSlug: string; artistName: string }) {
  const [tab, setTab] = useState('all')
  const [days, setDays] = useState(7)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Rango personalizado (calendario)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  // Auto-aplicar cuando ambas fechas están elegidas (ordena si vienen invertidas)
  useEffect(() => {
    if (!pickerOpen || !draftFrom || !draftTo) return
    setCustom(draftFrom <= draftTo ? { from: draftFrom, to: draftTo } : { from: draftTo, to: draftFrom })
  }, [pickerOpen, draftFrom, draftTo])

  const fetchMetrics = useCallback(async () => {
    setFetching(true)
    try {
      const platform = tab === 'all' ? '' : `&platform=${tab}`
      const range = custom ? `from=${custom.from}&to=${custom.to}` : `days=${days}`
      const res = await fetch(`/api/metrics/${artistSlug}?${range}${platform}`)
      if (res.ok) {
        const data = await res.json()
        setMetrics(data.metrics ?? [])
        setLastUpdated(new Date())
      }
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }, [artistSlug, tab, days, custom])

  useEffect(() => {
    setLoading(true)
    fetchMetrics()
    const interval = setInterval(fetchMetrics, REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const isYT = tab === 'google_youtube'
  const isSocial = tab === 'meta' || tab === 'tiktok'

  // ── Proyectos/canciones derivados de las campañas cargadas ──
  const [project, setProject] = useState('all')

  const projects = useMemo<ProjectSummary[]>(() => {
    const map = new Map<string, ProjectSummary>()
    for (const m of metrics) {
      const c = m.campaigns
      if (!c?.projectKey) continue
      if (!map.has(c.projectKey)) map.set(c.projectKey, { key: c.projectKey, label: c.project, spend: 0 })
      map.get(c.projectKey)!.spend += m.total_spend ?? 0
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend)
  }, [metrics])

  // Si el proyecto seleccionado desaparece (cambio de período/plataforma) → Global
  useEffect(() => {
    if (project !== 'all' && !projects.some((p) => p.key === project)) setProject('all')
  }, [projects, project])

  const selectedProject = project === 'all' ? null : projects.find((p) => p.key === project) ?? null
  const filtered = selectedProject
    ? metrics.filter((m) => m.campaigns?.projectKey === selectedProject.key)
    : metrics

  const totals = {
    impressions: filtered.reduce((s, m) => s + (m.impressions ?? 0), 0),
    spend: filtered.reduce((s, m) => s + (m.total_spend ?? 0), 0),
    reach: filtered.reduce((s, m) => s + (m.reach ?? 0), 0),
    views: filtered.reduce((s, m) => s + (m.public_views ?? 0), 0),
    thruviews: filtered.reduce((s, m) => s + (m.thruviews ?? 0), 0),
    thruplay: filtered.reduce((s, m) => s + (m.thruplay ?? 0), 0),
    results: filtered.reduce((s, m) => s + (m.result_count ?? 0), 0),
  }

  const groups = loading ? [] : groupByCampaign(filtered)
  const activeCount = groups.filter((g) => g.campaign.status === 'active').length

  // KPI con tendencia + sello de gira (EN RACHA / RÉCORD) calculados del mismo getter
  const mk = (label: string, value: number, format: 'number' | 'currency', getter: (m: Metric) => number) => {
    const trend = calcTrend(filtered, getter)
    return { label, value, format, trend, stamp: computeStamp(filtered, getter, trend) }
  }

  const spendTrend = calcTrend(filtered, (m) => m.total_spend ?? 0)
  const heroSubline = `vs. mitad anterior · ${activeCount} activas${projects[0] && project === 'all' ? ` · Top: ${projects[0].label}` : ''}`
  const hero = {
    label: 'Invertido',
    value: totals.spend,
    format: 'currency' as const,
    accent: true as const,
    trend: spendTrend,
    subline: heroSubline,
    stamp: computeStamp(filtered, (m) => m.total_spend ?? 0, spendTrend),
  }

  const kpis = isYT
    ? [
        mk('Vistas', totals.impressions, 'number', (m) => m.impressions ?? 0),
        hero,
        mk('Vistas Completas', totals.thruviews, 'number', (m) => m.thruviews ?? 0),
        mk('Vistas Públicas', totals.views, 'number', (m) => m.public_views ?? 0),
      ]
    : isSocial
    ? [
        mk('Vistas', totals.impressions, 'number', (m) => m.impressions ?? 0),
        hero,
        mk('Personas Alcanzadas', totals.reach, 'number', (m) => m.reach ?? 0),
        mk('Videos Vistos', totals.thruplay, 'number', (m) => m.thruplay ?? 0),
      ]
    : [
        mk('Vistas', totals.impressions, 'number', (m) => m.impressions ?? 0),
        hero,
        mk('Personas Alcanzadas', totals.reach, 'number', (m) => m.reach ?? 0),
        mk('Resultados', totals.results, 'number', (m) => m.result_count ?? 0),
      ]

  const donutData = spendByPlatform(filtered)
  const showDonut = tab === 'all' && donutData.length > 1

  // Vista Global con varios proyectos → barras por canción (clic = filtrar).
  // Proyecto seleccionado → barras por campaña de esa canción.
  const showProjectBars = project === 'all' && projects.length > 1
  const barsData: BarDatum[] = showProjectBars
    ? projects.slice(0, 8).map((p) => ({ key: p.key, name: p.label, value: p.spend, platform: '' })).filter((d) => d.value > 0)
    : groups.slice(0, 6).map((g) => ({
        name: g.campaign.name,
        value: g.metrics.reduce((s, m) => s + (m.total_spend ?? 0), 0),
        platform: g.campaign.platform,
      })).filter((d) => d.value > 0)

  const funnel = (tab === 'all' || isYT) ? retentionFunnel(filtered) : null
  const showRight = showDonut || !!funnel

  const rangeLabel = custom ? `${fmtDateEs(custom.from)} – ${fmtDateEs(custom.to)}` : (PERIOD_LABEL[days] ?? 'Período')
  const rangeKey = custom ? `${custom.from}_${custom.to}` : `d${days}`
  const periodLabel = rangeLabel + (selectedProject ? ` · ${selectedProject.label}` : '')

  const globalSpend = metrics.reduce((s, m) => s + (m.total_spend ?? 0), 0)

  // ── Exportar CSV: exactamente lo que el PM está viendo (filtros aplicados) ──
  const exportFilename = (kind: string) => {
    const plat = tab === 'all' ? 'todas' : slugify(PLAT_LABEL[tab] ?? tab)
    const proj = selectedProject ? `-${slugify(selectedProject.label)}` : ''
    const range = custom ? `${custom.from}_a_${custom.to}` : `ultimos-${days}-dias`
    return `rimas-${artistSlug}${proj}-${plat}-${range}-${kind}.csv`
  }

  const round2 = (n: number | null | undefined) => (n == null ? '' : n.toFixed(2))

  const exportSummary = () => {
    const rows: (string | number)[][] = [[
      'Campaña', 'Plataforma', 'Canción / Proyecto', 'Estado',
      'Vistas (impresiones)', 'Invertido (USD)', '% Clics prom.',
      'Vistas completas', 'Retención prom. %', 'Personas únicas',
      'Videos vistos (ThruPlay)', 'Resultados', 'Días con datos', 'Del', 'Al',
    ]]
    for (const g of groups) {
      const sorted = [...g.metrics].sort((a, b) => a.date.localeCompare(b.date))
      const sum = (fn: (m: Metric) => number) => sorted.reduce((s, m) => s + (fn(m) ?? 0), 0)
      const avg = (fn: (m: Metric) => number | null) => {
        const v = sorted.map(fn).filter((x): x is number => x != null)
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
      }
      rows.push([
        g.campaign.name,
        PLAT_LABEL[g.campaign.platform] ?? g.campaign.platform,
        g.campaign.project,
        STATUS_CSV[g.campaign.status] ?? g.campaign.status,
        sum((m) => m.impressions),
        round2(sum((m) => m.total_spend)),
        round2(avg((m) => m.ctr)),
        sum((m) => m.thruviews),
        round2(avg((m) => m.video_retention)),
        sum((m) => m.reach),
        sum((m) => m.thruplay),
        sum((m) => m.result_count),
        new Set(sorted.map((m) => m.date)).size,
        sorted[0]?.date ?? '',
        sorted[sorted.length - 1]?.date ?? '',
      ])
    }
    downloadCsv(exportFilename('resumen'), rows)
  }

  const exportDaily = () => {
    const rows: (string | number)[][] = [[
      'Fecha', 'Campaña', 'Plataforma', 'Canción / Proyecto',
      'Vistas (impresiones)', 'Invertido (USD)', '% Clics', 'CPM (USD)',
      'Vistas completas', 'Retención %', 'Personas únicas',
      'Videos vistos (ThruPlay)', 'Resultados', 'Costo por resultado (USD)',
    ]]
    const sorted = [...filtered].sort((a, b) =>
      a.date === b.date ? a.campaigns.name.localeCompare(b.campaigns.name) : a.date.localeCompare(b.date)
    )
    for (const m of sorted) {
      rows.push([
        m.date,
        m.campaigns.name,
        PLAT_LABEL[m.campaigns.platform] ?? m.campaigns.platform,
        m.campaigns.project,
        m.impressions ?? 0,
        round2(m.total_spend),
        round2(m.ctr),
        round2(m.cpm),
        m.thruviews ?? 0,
        round2(m.video_retention),
        m.reach ?? 0,
        m.thruplay ?? 0,
        m.result_count ?? 0,
        round2(m.cost_per_result),
      ])
    }
    downloadCsv(exportFilename('detalle-diario'), rows)
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-7">
      <LaserBar loading={fetching} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex w-full sm:w-auto bg-white border border-[#e6e6e8] rounded-full p-1 shadow-[var(--shadow-card)]">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 sm:flex-none rounded-full px-2 sm:px-5 py-2 text-xs uppercase tracking-widest font-bold active:scale-95 ${
                  active ? 'text-white' : 'text-[#9b9ba3] hover:text-[#0a0a0b]'
                }`}
                style={{
                  ...C,
                  transition: 'all 200ms var(--ease-snap)',
                  ...(active ? { background: 'var(--grad-encendido)', boxShadow: 'var(--shadow-red-glow)' } : {}),
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          <select
            value={pickerOpen ? 'custom' : days}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                // Prellenar con el rango equivalente al preset actual
                setDraftTo(today)
                setDraftFrom(new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10))
                setPickerOpen(true)
              } else {
                setPickerOpen(false)
                setCustom(null)
                setDays(Number(e.target.value))
              }
            }}
            className="flex-1 sm:flex-none bg-white border border-[#e6e6e8] text-xs text-[#5b5b63] uppercase tracking-widest rounded-xl px-3 py-2.5 sm:py-2 focus:outline-none focus:border-[#E8192C] focus:shadow-[var(--shadow-red-halo)] transition-all"
            style={C}
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 3 meses</option>
            <option value={180}>Últimos 6 meses</option>
            <option value={365}>Todo el año</option>
            <option value="custom">Personalizado…</option>
          </select>
          <ExportMenu
            disabled={loading || filtered.length === 0}
            onSummary={exportSummary}
            onDaily={exportDaily}
          />
          {lastUpdated && (
            <span className="text-[#9b9ba3] text-xs hidden lg:inline" style={C}>
              Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Calendario: rango personalizado */}
      {pickerOpen && (
        <div className="flex flex-wrap items-center gap-2 animate-rise">
          <label className="flex items-center gap-2 bg-white border border-[#e6e6e8] rounded-xl px-3 py-2 shadow-[var(--shadow-card)]">
            <span className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>Del</span>
            <input
              type="date"
              value={draftFrom}
              max={draftTo || today}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="bg-transparent text-xs text-[#0a0a0b] font-bold focus:outline-none"
              style={C}
            />
          </label>
          <label className="flex items-center gap-2 bg-white border border-[#e6e6e8] rounded-xl px-3 py-2 shadow-[var(--shadow-card)]">
            <span className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>Al</span>
            <input
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              max={today}
              onChange={(e) => setDraftTo(e.target.value)}
              className="bg-transparent text-xs text-[#0a0a0b] font-bold focus:outline-none"
              style={C}
            />
          </label>
          {custom && (
            <span className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>
              {fmtDateEs(custom.from)} – {fmtDateEs(custom.to)}
            </span>
          )}
        </div>
      )}

      {/* Cinta de estadio */}
      {!loading && metrics.length > 0 && (
        <HypeTicker
          impressions={totals.impressions}
          spend={totals.spend}
          activeCount={activeCount}
          topProject={projects[0] ?? null}
        />
      )}

      {/* Proyecto / canción */}
      {!loading && projects.length > 1 && (
        <ProjectChips projects={projects} selected={project} onSelect={setProject} globalSpend={globalSpend} />
      )}

      {/* Resumen general */}
      <section>
        <SectionHeader
          title={selectedProject ? selectedProject.label : 'Resumen General'}
          subtitle={periodLabel}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)
            : kpis.map((k, i) => <KpiCard key={k.label} {...k} stagger={i} />)}
        </div>
      </section>

      {/* Análisis */}
      {!loading && metrics.length > 0 && (barsData.length > 0 || showDonut || funnel) && (
        <section>
          <SectionHeader title="Análisis" subtitle="Dónde está el dinero y la atención" />
          <div key={`${tab}-${rangeKey}-${project}`} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start animate-chart">
            {barsData.length > 0 && (
              <ChartCard
                title={showProjectBars ? 'Inversión por canción' : 'Inversión por campaña'}
                subtitle={
                  showProjectBars
                    ? 'Toca una barra para ver esa canción'
                    : selectedProject
                    ? `Campañas de ${selectedProject.label}`
                    : 'Top campañas del período'
                }
                className={showRight ? 'lg:col-span-2' : 'lg:col-span-3'}
              >
                <CampaignBars
                  data={barsData}
                  onBarClick={showProjectBars ? (d) => d.key && setProject(d.key) : undefined}
                />
              </ChartCard>
            )}
            {showRight && (
              <div className={barsData.length > 0 ? 'lg:col-span-1 space-y-4' : 'lg:col-span-3 grid sm:grid-cols-2 gap-4 items-start'}>
                {showDonut && (
                  <ChartCard title="Inversión por plataforma" subtitle="Reparto del gasto">
                    <PlatformDonut data={donutData} total={totals.spend} />
                  </ChartCard>
                )}
                {funnel && (
                  <ChartCard title="Retención de video" subtitle="YouTube · de impresión a vista completa">
                    <RetentionFunnel stages={funnel} />
                  </ChartCard>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Campañas */}
      <section>
        <SectionHeader
          title="Campañas"
          subtitle={
            loading
              ? artistName
              : `${artistName}${selectedProject ? ` · ${selectedProject.label}` : ''} · ${groups.length} en total · ${activeCount} activas`
          }
        />
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : metrics.length === 0 ? (
          <div className="border border-[#e6e6e8] bg-white rounded-2xl p-16 text-center shadow-[var(--shadow-card)]">
            <p className="text-[#5b5b63] text-xs uppercase tracking-widest" style={C}>Sin datos para este período</p>
            <p className="text-[#c4c4c8] text-xs mt-2" style={C}>El escenario está listo — pronto habrá números</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, i) => <CampaignRow key={group.campaign.id} group={group} index={i} />)}
          </div>
        )}
      </section>
    </main>
  )
}
