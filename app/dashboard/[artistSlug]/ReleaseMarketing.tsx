'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  spendMxn,
  summarizePaidMedia,
  type PaidMetric,
  type PaidPlatform,
} from '@/lib/releaseSummary'

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

const LINE_COLOR: Record<PaidPlatform, string> = {
  google_youtube: '#FF0000',
  tiktok: '#111827',
  meta: '#1877F2',
}

export type ReleaseCard = {
  slug: string
  title: string
  typeLabel: string
  active: boolean
  campaignStart: string
  publicYoutubeViews: number | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; metrics: PaidMetric[]; syncedAt: string | null; usdToMxn: number | null }

function fmtCount(n: number) {
  return Math.round(n).toLocaleString('es-MX')
}

function fmtAmount(n: number, currency: 'MXN' | 'USD', maxFraction: number) {
  const amount = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFraction,
  }).format(n)
  return `$${amount} ${currency}`
}

function fmtMoney(n: number, currency: 'MXN' | 'USD') {
  return fmtAmount(n, currency, 2)
}

function fmtCpv(n: number, currency: 'MXN' | 'USD') {
  const fractionDigits = n > 0 && n < 0.01 ? 4 : 2
  return fmtAmount(n, currency, fractionDigits)
}

function fmtDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

function corteLabel(iso: string | null) {
  if (!iso) return 'Corte: sin datos sincronizados'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Corte: sin datos sincronizados'
  const text = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `Corte: ${text}`
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-7 bg-[#E8192C] rounded-full" />
      <div>
        <h2 className="text-[#0a0a0b] text-2xl font-black uppercase tracking-wide" style={C}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-[#9b9ba3] text-xs mt-0.5" style={C}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

export default function ReleaseMarketing({
  artistSlug,
  releases,
  selectedSlug,
  latestActiveSlug,
}: {
  artistSlug: string
  releases: ReleaseCard[]
  selectedSlug: string
  latestActiveSlug: string | null
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const selected = releases.find((release) => release.slug === selectedSlug) ?? null
  const ordered = useMemo(
    () => [...releases].sort((a, b) => b.campaignStart.localeCompare(a.campaignStart)),
    [releases]
  )

  useEffect(() => {
    let cancelled = false
    const to = new Date().toISOString().slice(0, 10)
    const params = new URLSearchParams({
      from: '2020-01-01',
      to,
      release: selectedSlug,
    })
    fetch(`/api/metrics/${artistSlug}?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('metrics')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setLoad({
          status: 'ready',
          metrics: Array.isArray(data.metrics) ? data.metrics : [],
          syncedAt: typeof data.syncedAt === 'string' ? data.syncedAt : null,
          usdToMxn: typeof data.usdToMxn === 'number' ? data.usdToMxn : null,
        })
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [artistSlug, selectedSlug])

  const summary = load.status === 'ready' ? summarizePaidMedia(load.metrics) : null
  const usdToMxn = load.status === 'ready' ? load.usdToMxn : null
  const syncedAt = load.status === 'ready' ? load.syncedAt : null
  const isActiveHero = selected != null && selected.slug === latestActiveSlug
  const chartSeries = summary?.platforms.filter((platform) => platform.hasRows) ?? []

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-[#0a0a0b] text-white rounded-[24px] p-6 sm:p-8 min-h-[280px] flex flex-col justify-between">
          <div>
            <p className="text-white/60 text-[10px] uppercase tracking-[0.28em] font-bold" style={C}>
              Vistas en YouTube
            </p>
            <p className="text-[#E8192C] text-xs uppercase tracking-[0.22em] font-bold mt-3" style={C}>
              {isActiveHero && selected
                ? `Lanzamiento activo · ${selected.typeLabel}`
                : selected?.typeLabel ?? 'Lanzamiento'}
            </p>
            <h2 className="text-white text-4xl sm:text-5xl font-black uppercase leading-[0.9] tracking-tight mt-2" style={C}>
              {selected?.title ?? 'Sin lanzamiento'}
            </h2>
          </div>

          {selected?.publicYoutubeViews == null ? (
            <div className="mt-8">
              <p className="text-3xl sm:text-4xl font-black uppercase leading-tight" style={C}>
                Pendiente: conectar canal de YouTube
              </p>
              <p className="text-white/60 text-sm mt-3 max-w-md">
                Este número es el de las vistas públicas del canal. No usamos las reproducciones de la pauta aquí.
              </p>
            </div>
          ) : (
            <p className="mt-8 text-6xl sm:text-7xl font-black tabular-nums leading-none" style={C}>
              {fmtCount(selected.publicYoutubeViews)}
            </p>
          )}
        </div>

        <aside className="lg:col-span-2 bg-white border border-[#e6e6e8] rounded-[24px] p-6 shadow-[var(--shadow-card)] flex flex-col gap-5">
          <div>
            <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.22em] font-bold" style={C}>
              Gasto
            </p>
            {load.status === 'loading' && <p className="text-[#9b9ba3] text-sm mt-2">Leyendo campañas…</p>}
            {load.status === 'error' && (
              <p className="text-[#5b5b63] text-sm mt-2">
                No se pudo leer el gasto. No mostramos números de ejemplo.
              </p>
            )}
            {load.status === 'ready' && !summary?.hasRows && (
              <p className="text-[#5b5b63] text-sm mt-2">Este lanzamiento todavía no tiene gasto registrado.</p>
            )}
            {load.status === 'ready' && summary?.hasRows && (
              <div className="mt-2 space-y-1">
                {spendMxn(summary.spendUsd, usdToMxn) == null ? (
                  <p className="text-[#9b9ba3] text-sm">MXN pendiente: tipo de cambio</p>
                ) : (
                  <p className="text-[#0a0a0b] text-3xl font-black tabular-nums leading-none" style={C}>
                    {fmtMoney(spendMxn(summary.spendUsd, usdToMxn) as number, 'MXN')}
                  </p>
                )}
                <p className="text-[#0a0a0b] text-xl font-black tabular-nums" style={C}>
                  {fmtMoney(summary.spendUsd, 'USD')}
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.22em] font-bold mb-2" style={C}>
              Costo por vista
            </p>
            {load.status === 'loading' && <p className="text-[#9b9ba3] text-sm">Leyendo campañas…</p>}
            {load.status === 'error' && (
              <p className="text-[#5b5b63] text-sm">No se pudo calcular el costo por vista.</p>
            )}
            {load.status === 'ready' && (
              <ul className="space-y-2">
                {summary?.platforms.map((platform) => (
                  <li key={platform.platform} className="flex items-baseline justify-between gap-3">
                    <span className="text-[#0a0a0b] text-sm font-bold uppercase tracking-wide" style={C}>
                      {platform.label}
                    </span>
                    <span className="text-[#5b5b63] text-sm text-right">
                      {!platform.hasRows && 'Sin datos'}
                      {platform.hasRows && platform.cpvUsd == null && `Sin ${platform.playsLabel.toLowerCase()} para calcularlo`}
                      {platform.hasRows && platform.cpvUsd != null && (
                        <span>
                          {fmtCpv(platform.cpvUsd, 'USD')}
                          {spendMxn(platform.cpvUsd, usdToMxn) != null && (
                            <span className="block">{fmtCpv(spendMxn(platform.cpvUsd, usdToMxn) as number, 'MXN')}</span>
                          )}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-auto text-[#9b9ba3] text-xs uppercase tracking-widest font-bold" style={C}>
            {load.status === 'loading'
              ? 'Corte: leyendo sincronización…'
              : load.status === 'ready'
                ? corteLabel(syncedAt)
                : 'Corte: sin datos sincronizados'}
          </p>
        </aside>
      </section>

      <section>
        <SectionTitle title="Lanzamientos" subtitle="Elige un sencillo para ver su pauta" />
        <nav aria-label="Lanzamientos" className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {ordered.map((release) => {
            const current = release.slug === selectedSlug
            return (
              <Link
                key={release.slug}
                href={`/dashboard/${artistSlug}/${release.slug}`}
                aria-current={current ? 'page' : undefined}
                className={`snap-start shrink-0 w-[240px] sm:w-[280px] rounded-2xl px-5 py-4 border transition-all ${
                  current
                    ? 'bg-[#0a0a0b] text-white border-[#0a0a0b]'
                    : 'bg-white text-[#0a0a0b] border-[#e6e6e8] hover:border-[#E8192C]/50'
                }`}
              >
                <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#E8192C]" style={C}>
                  {release.typeLabel}
                  {release.slug === latestActiveSlug ? ' · Activo' : ''}
                </span>
                <p className="mt-2 text-2xl font-black uppercase leading-none" style={C}>
                  {release.title}
                </p>
              </Link>
            )
          })}
        </nav>
      </section>

      <section>
        <SectionTitle
          title="Pauta del lanzamiento"
          subtitle={selected ? selected.title : undefined}
        />
        {load.status === 'loading' && (
          <p className="text-[#9b9ba3] text-sm">Leyendo YouTube, TikTok y Meta…</p>
        )}
        {load.status === 'error' && (
          <div className="bg-white border border-[#e6e6e8] rounded-2xl p-8">
            <p className="text-[#0a0a0b] font-bold" style={C}>
              No se pudieron leer las campañas
            </p>
            <p className="text-[#5b5b63] text-sm mt-2">
              Puede faltar la conexión con los datos. Esta vista queda vacía: no inventamos gasto, vistas ni reproducciones.
            </p>
          </div>
        )}
        {load.status === 'ready' && !summary?.hasRows && (
          <div className="bg-white border border-[#e6e6e8] rounded-2xl p-8">
            <p className="text-[#0a0a0b] font-bold" style={C}>
              Sin campañas para este lanzamiento
            </p>
            <p className="text-[#5b5b63] text-sm mt-2">
              Cuando la sincronización traiga gasto de YouTube, TikTok o Meta, aparece aquí.
            </p>
          </div>
        )}
        {load.status === 'ready' && summary?.hasRows && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {summary.platforms.map((platform) => (
                <article key={platform.platform} className="bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)]">
                  <h3 className="text-xl font-black uppercase" style={C}>
                    {platform.label}
                  </h3>
                  {!platform.hasRows ? (
                    <p className="text-[#9b9ba3] text-sm mt-4">Sin datos</p>
                  ) : (
                    <dl className="mt-4 space-y-3">
                      <div>
                        <dt className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>Gasto</dt>
                        <dd className="text-[#0a0a0b] text-lg font-black tabular-nums" style={C}>
                          {fmtMoney(platform.spendUsd, 'USD')}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>Impresiones</dt>
                        <dd className="text-[#0a0a0b] text-lg font-black tabular-nums" style={C}>
                          {fmtCount(platform.impressions)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>
                          {platform.playsLabel}
                        </dt>
                        <dd className="text-[#0a0a0b] text-lg font-black tabular-nums" style={C}>
                          {fmtCount(platform.plays)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>
                          Costo por vista
                        </dt>
                        <dd className="text-[#0a0a0b] text-lg font-black tabular-nums" style={C}>
                          {platform.cpvUsd == null ? '—' : fmtCpv(platform.cpvUsd, 'USD')}
                          {platform.cpvUsd != null && spendMxn(platform.cpvUsd, usdToMxn) != null && (
                            <span className="block text-sm text-[#5b5b63]">
                              {fmtCpv(spendMxn(platform.cpvUsd, usdToMxn) as number, 'MXN')}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  )}
                </article>
              ))}
            </div>

            <div className="bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <h3 className="text-xl font-black uppercase mb-4" style={C}>
                Gasto por día
              </h3>
              {chartSeries.length === 0 || summary.daily.length === 0 ? (
                <p className="text-[#9b9ba3] text-sm">Sin serie diaria.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={summary.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#f0f0f1" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: '#9b9ba3' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tickFormatter={(value) => {
                          const amount = Number(value)
                          if (amount >= 1000) {
                            return `$${(amount / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil`
                          }
                          return `$${amount.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
                        }}
                        tick={{ fontSize: 11, fill: '#9b9ba3' }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        formatter={(value, name) => [fmtMoney(Number(value ?? 0), 'USD'), String(name)]}
                        labelFormatter={(label) => fmtDay(String(label))}
                      />
                      <Legend />
                      {chartSeries.map((platform) => (
                        <Line
                          key={platform.platform}
                          type="monotone"
                          dataKey={platform.platform}
                          name={platform.label}
                          stroke={LINE_COLOR[platform.platform]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-[#e6e6e8] rounded-2xl px-5 py-4 shadow-[var(--shadow-card)]">
        <p className="text-[#E8192C] text-[10px] uppercase tracking-[0.22em] font-bold" style={C}>
          Próximamente
        </p>
        <h2 className="text-[#0a0a0b] text-xl font-black uppercase mt-1" style={C}>
          Países
        </h2>
        <p className="text-[#5b5b63] text-sm mt-1">
          Todavía no tenemos el desglose por país.
        </p>
      </section>
    </main>
  )
}
