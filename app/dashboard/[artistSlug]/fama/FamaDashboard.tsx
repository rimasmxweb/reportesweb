'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  dailyPoints,
  rollupCampaigns,
  spendMxn,
  summarizePaidMedia,
  type PaidMetric,
  type PaidPlatform,
} from '@/lib/releaseSummary'
import {
  formatCompact,
  formatCount,
  formatCpv,
  formatDay,
  formatFullDay,
  formatMoney,
  formatStamp,
} from '@/lib/famaFormat'
import { windowForRange, type FamaRange } from '@/lib/famaWindow'
import type { FamaReleaseCard } from '@/lib/famaTypes'

const RANGES: { key: FamaRange; label: string }[] = [
  { key: '7', label: '7 días' },
  { key: '14', label: '14 días' },
  { key: '30', label: '30 días' },
  { key: 'all', label: 'Desde el inicio' },
]

const PLATFORM_ORDER: PaidPlatform[] = ['google_youtube', 'meta', 'tiktok']

const SERIES: Record<PaidPlatform | 'spend', string> = {
  spend: '#f6f1ea',
  google_youtube: '#ff6b7a',
  meta: '#a8b0ff',
  tiktok: '#f0c9a0',
}

const STATUS: Record<string, string> = {
  active: 'Activa',
  paused: 'Pausada',
  ended: 'Finalizada',
  ALERTA: 'Alerta',
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; metrics: PaidMetric[]; syncedAt: string | null; usdToMxn: number | null }

type ChartMode = 'spend' | 'plays'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  return reduced
}

function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState<number | null>(null)

  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    const duration = 1100
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(value * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])

  return <>{format(reduced || shown == null ? value : shown)}</>
}

function statusLabel(status: string) {
  if (!status) return 'Sin estado'
  return STATUS[status] ?? status
}

function playsCaption(platform: PaidPlatform) {
  return platform === 'google_youtube' ? 'Vistas de pauta' : 'Reproducciones'
}

export default function FamaDashboard({
  artistSlug,
  artistName,
  photo,
  releases,
  selectedSlug,
  latestActiveSlug,
  today,
}: {
  artistSlug: string
  artistName: string
  photo: string | null
  releases: FamaReleaseCard[]
  selectedSlug: string
  latestActiveSlug: string | null
  today: string
}) {
  const reduced = usePrefersReducedMotion()
  const [range, setRange] = useState<FamaRange>('all')
  const [chartMode, setChartMode] = useState<ChartMode>('spend')
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

  const selected = releases.find((release) => release.slug === selectedSlug) ?? releases[0]
  const ordered = useMemo(
    () => [...releases].sort((a, b) => b.campaignStart.localeCompare(a.campaignStart)),
    [releases]
  )
  const bounds = useMemo(
    () => (selected ? windowForRange(range, selected.campaignStart, today) : null),
    [range, selected, today]
  )
  const windowFrom = bounds?.from ?? ''
  const windowTo = bounds?.to ?? ''
  const releaseSlug = selected?.slug ?? ''

  useEffect(() => {
    if (!releaseSlug || !windowFrom || !windowTo) return
    let cancelled = false
    const params = new URLSearchParams({
      from: windowFrom,
      to: windowTo,
      release: releaseSlug,
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
  }, [artistSlug, releaseSlug, windowFrom, windowTo])

  const summary = load.status === 'ready' ? summarizePaidMedia(load.metrics) : null
  const campaigns = load.status === 'ready' ? rollupCampaigns(load.metrics) : []
  const series = load.status === 'ready' ? dailyPoints(load.metrics) : []
  const usdToMxn = load.status === 'ready' ? load.usdToMxn : null
  const syncedAt = load.status === 'ready' ? load.syncedAt : null
  const platforms = PLATFORM_ORDER.map(
    (key) => summary?.platforms.find((platform) => platform.platform === key)
  ).filter((platform): platform is NonNullable<typeof platform> => Boolean(platform))
  const playSeries = platforms.filter((platform) => platform.plays > 0)
  const isLatest = selected != null && selected.slug === latestActiveSlug
  const phases = [...(selected?.phases ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const past = phases.filter((phase) => phase.date < today)
  const upcoming = phases.filter((phase) => phase.date > today)
  const corte =
    load.status === 'loading'
      ? 'Corte: leyendo…'
      : load.status === 'error'
        ? 'Corte: sin datos'
        : formatStamp('Corte', syncedAt, 'Corte: sin fecha de sincronización')

  return (
    <div className="fama-main">
      <section className="fama-hero" aria-label="Vistas públicas">
        {photo && (
          <Image
            src={photo}
            alt={artistName}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_18%]"
          />
        )}
        <div className="fama-hero-shade" />
        <div className="fama-hero-copy fama-rise">
          <p className="fama-kicker">
            {selected?.piece ?? selected?.typeLabel ?? 'Lanzamiento'}
            {isLatest ? ' · el más reciente' : ''}
          </p>
          <h2 className="fama-display fama-hero-title">{selected?.song ?? artistName}</h2>
          {selected && selected.title !== selected.song && (
            <p className="fama-hero-note">{selected.title}</p>
          )}
          {selected?.note && <p className="fama-hero-note">{selected.note}</p>}

          {selected?.publicViews == null ? (
            <p className="fama-display fama-hero-pending">Pendiente</p>
          ) : (
            <p className="fama-display fama-hero-number">
              <CountUp value={selected.publicViews} format={formatCount} />
            </p>
          )}
          <p className="fama-hero-caption">Vistas públicas del video</p>
          <p className="fama-hero-meta">
            {formatStamp('Consulta', selected?.publicViewsFetchedAt ?? null, 'Consulta: Pendiente')}
          </p>
          <p className="fama-hero-meta">Este número es el video. No suma la pauta ni otros lanzamientos.</p>
          {selected?.youtubeVideoId && (
            <a
              className="fama-text-link"
              href={`https://www.youtube.com/watch?v=${selected.youtubeVideoId}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver el video
            </a>
          )}
        </div>
      </section>

      <div className="fama-wrap">
        <nav className="fama-subnav" aria-label="Secciones">
          <a href="#lanzamientos">Lanzamientos</a>
          <a href="#avance">Avance</a>
          <a href="#pauta">Pauta</a>
          <a href="#paises">Países</a>
          <a href="#plan">Plan</a>
        </nav>

        <section id="lanzamientos" className="fama-section fama-rise">
          <header className="fama-section-head">
            <p className="fama-kicker">Catálogo</p>
            <h3 className="fama-display fama-section-title">Lanzamientos</h3>
            <p className="fama-quiet">Elige una pieza. Cada una tiene sus propios números.</p>
          </header>
          <div className="fama-rail" role="list">
            {ordered.map((release) => {
              const current = release.slug === selectedSlug
              return (
                <Link
                  key={release.slug}
                  href={`/dashboard/${artistSlug}/${release.slug}`}
                  role="listitem"
                  aria-current={current ? 'page' : undefined}
                  className={`fama-release${current ? ' is-current' : ''}`}
                >
                  <span className="fama-kicker">
                    {release.piece ?? release.typeLabel}
                    {release.slug === latestActiveSlug ? ' · reciente' : ''}
                  </span>
                  <span className="fama-display fama-release-title">{release.title}</span>
                  <span className="fama-release-views">
                    {release.publicViews == null ? 'Pendiente' : `${formatCount(release.publicViews)} vistas públicas`}
                  </span>
                  <span className="fama-quiet">{formatFullDay(release.campaignStart)}</span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="fama-section" aria-label="Indicadores">
          <div className="fama-kpi-grid">
            <article className="fama-card fama-kpi fama-rise">
              <p className="fama-kicker">Gasto del corte</p>
              {load.status === 'loading' && <p className="fama-quiet">Leyendo campañas…</p>}
              {load.status === 'error' && (
                <p className="fama-quiet">No se pudo leer el gasto. No mostramos números de ejemplo.</p>
              )}
              {load.status === 'ready' && !summary?.hasRows && (
                <p className="fama-quiet">Este lanzamiento todavía no tiene gasto en el corte.</p>
              )}
              {load.status === 'ready' && summary?.hasRows && (
                <div className="fama-kpi-figures">
                  {spendMxn(summary.spendUsd, usdToMxn) == null ? (
                    <p className="fama-quiet">MXN pendiente: falta el tipo de cambio</p>
                  ) : (
                    <p className="fama-display fama-kpi-number">
                      <CountUp
                        value={spendMxn(summary.spendUsd, usdToMxn) as number}
                        format={(n) => formatMoney(n, 'MXN')}
                      />
                    </p>
                  )}
                  <p className="fama-kpi-sub">
                    <CountUp value={summary.spendUsd} format={(n) => formatMoney(n, 'USD')} />
                  </p>
                </div>
              )}
              <p className="fama-corte">{corte}</p>
              {bounds && (
                <p className="fama-quiet">
                  {formatFullDay(bounds.from)} – {formatFullDay(bounds.to)}
                </p>
              )}
            </article>

            {PLATFORM_ORDER.map((key, index) => {
              const platform = platforms.find((item) => item.platform === key)
              return (
                <article
                  key={key}
                  className="fama-card fama-kpi fama-rise"
                  style={{ animationDelay: `${(index + 1) * 70}ms` }}
                >
                  <p className="fama-kicker">{platformLabel(key)}</p>
                  {key === 'google_youtube' && <p className="fama-platform-note">Google Ads</p>}
                  {load.status === 'loading' && <p className="fama-quiet">Leyendo…</p>}
                  {load.status === 'error' && <p className="fama-quiet">Sin lectura</p>}
                  {load.status === 'ready' && (!platform || !platform.hasRows) && (
                    <p className="fama-quiet">Sin datos</p>
                  )}
                  {load.status === 'ready' && platform?.hasRows && (
                    <>
                      <p className="fama-display fama-kpi-number">
                        <CountUp value={platform.plays} format={formatCount} />
                      </p>
                      <p className="fama-kpi-sub">{playsCaption(key)}</p>
                      <p className="fama-cpv">
                        <span>Costo por vista</span>
                        {platform.cpvUsd == null ? (
                          <strong>Sin vistas para calcularlo</strong>
                        ) : (
                          <strong>
                            {formatCpv(platform.cpvUsd, 'USD')}
                            {spendMxn(platform.cpvUsd, usdToMxn) != null && (
                              <em>{formatCpv(spendMxn(platform.cpvUsd, usdToMxn) as number, 'MXN')}</em>
                            )}
                          </strong>
                        )}
                      </p>
                    </>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section id="avance" className="fama-section fama-card fama-chart-card fama-rise">
          <header className="fama-chart-head">
            <div>
              <p className="fama-kicker">Día a día</p>
              <h3 className="fama-display fama-section-title">Avance diario</h3>
              {bounds && (
                <p className="fama-quiet">
                  {formatFullDay(bounds.from)} – {formatFullDay(bounds.to)}
                </p>
              )}
            </div>
            <div className="fama-controls">
              <div className="fama-pills" role="group" aria-label="Qué ver en la gráfica">
                <button
                  type="button"
                  aria-pressed={chartMode === 'spend'}
                  className={chartMode === 'spend' ? 'is-on' : ''}
                  onClick={() => setChartMode('spend')}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  aria-pressed={chartMode === 'plays'}
                  className={chartMode === 'plays' ? 'is-on' : ''}
                  onClick={() => setChartMode('plays')}
                >
                  Reproducciones
                </button>
              </div>
              <div className="fama-pills" role="group" aria-label="Rango del corte">
                {RANGES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={range === item.key}
                    className={range === item.key ? 'is-on' : ''}
                    onClick={() => {
                      setRange(item.key)
                      setLoad({ status: 'loading' })
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {load.status === 'loading' && <p className="fama-quiet fama-chart-empty">Leyendo la serie diaria…</p>}
          {load.status === 'error' && (
            <p className="fama-quiet fama-chart-empty">
              No se pudo armar la gráfica. Hace falta la conexión con las campañas.
            </p>
          )}
          {load.status === 'ready' && (series.length === 0 || (chartMode === 'spend' && !summary?.hasRows)) && (
            <p className="fama-quiet fama-chart-empty">No hay serie diaria en este corte.</p>
          )}
          {load.status === 'ready' && chartMode === 'plays' && summary?.hasRows && playSeries.length === 0 && (
            <p className="fama-quiet fama-chart-empty">Hay gasto, pero no hay vistas ni reproducciones en este corte.</p>
          )}
          {load.status === 'ready' && series.length > 0 && summary?.hasRows && (chartMode === 'spend' || playSeries.length > 0) && (
            <div className="fama-chart-in" key={`${chartMode}-${range}-${selectedSlug}`}>
              <div className="fama-chart-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(246,241,234,0.08)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDay}
                      tick={{ fill: '#8d827b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        chartMode === 'spend' ? `$${formatCompact(Number(value))}` : formatCompact(Number(value))
                      }
                      tick={{ fill: '#8d827b', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <Tooltip
                      cursor={{ stroke: 'rgba(246,241,234,0.25)' }}
                      contentStyle={{
                        background: '#211c24',
                        border: '1px solid rgba(246,241,234,0.12)',
                        borderRadius: 12,
                        color: '#f6f1ea',
                      }}
                      labelFormatter={(label) => formatFullDay(String(label))}
                      formatter={(value, name) => [
                        chartMode === 'spend'
                          ? formatMoney(Number(value ?? 0), 'USD')
                          : formatCount(Number(value ?? 0)),
                        String(name),
                      ]}
                    />
                    {chartMode === 'spend' ? (
                      <Line
                        type="monotone"
                        dataKey="spend"
                        name="Gasto"
                        stroke={SERIES.spend}
                        strokeWidth={2.25}
                        dot={false}
                        isAnimationActive={!reduced}
                        animationDuration={900}
                      />
                    ) : (
                      playSeries.map((platform) => (
                        <Line
                          key={platform.platform}
                          type="monotone"
                          dataKey={platform.platform}
                          name={platform.label}
                          stroke={SERIES[platform.platform]}
                          strokeWidth={2.25}
                          dot={false}
                          isAnimationActive={!reduced}
                          animationDuration={900}
                        />
                      ))
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="fama-legend">
                {chartMode === 'spend' ? (
                  <li>
                    <i style={{ background: SERIES.spend }} /> Gasto en dólares
                  </li>
                ) : (
                  playSeries.map((platform) => (
                    <li key={platform.platform}>
                      <i style={{ background: SERIES[platform.platform] }} /> {platform.label}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </section>

        <section id="pauta" className="fama-section fama-rise">
          <header className="fama-section-head">
            <p className="fama-kicker">Medios pagados</p>
            <h3 className="fama-display fama-section-title">Campañas</h3>
            <p className="fama-quiet">
              {selected ? `${selected.title}. ` : ''}
              YouTube, Meta y TikTok del corte elegido.
            </p>
          </header>

          {load.status === 'loading' && <p className="fama-quiet">Leyendo campañas…</p>}
          {load.status === 'error' && (
            <div className="fama-card fama-empty">
              <p className="fama-display fama-empty-title">No se pudo leer la pauta</p>
              <p className="fama-quiet">Hace falta la conexión con las campañas. Esta vista queda vacía.</p>
            </div>
          )}
          {load.status === 'ready' && campaigns.length === 0 && (
            <div className="fama-card fama-empty">
              <p className="fama-display fama-empty-title">Sin campañas en este corte</p>
              <p className="fama-quiet">
                Cuando la sincronización traiga gasto de este lanzamiento, las campañas aparecen aquí.
              </p>
            </div>
          )}
          {load.status === 'ready' && campaigns.length > 0 && (
            <ul className="fama-campaigns">
              {campaigns.map((campaign) => (
                <li key={`${campaign.platform}-${campaign.name}`} className="fama-card fama-campaign">
                  <div>
                    <p className="fama-kicker">{campaign.label}</p>
                    <p className="fama-campaign-name">{campaign.name}</p>
                    <p className="fama-quiet">{statusLabel(campaign.status)}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Gasto</dt>
                      <dd>{formatMoney(campaign.spendUsd, 'USD')}</dd>
                    </div>
                    <div>
                      <dt>{playsCaption(campaign.platform)}</dt>
                      <dd>{formatCount(campaign.plays)}</dd>
                    </div>
                    <div>
                      <dt>Costo por vista</dt>
                      <dd>{campaign.cpvUsd == null ? '—' : formatCpv(campaign.cpvUsd, 'USD')}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="paises" className="fama-section fama-rise">
          <header className="fama-section-head">
            <p className="fama-kicker">Dónde se vio</p>
            <h3 className="fama-display fama-section-title">Países</h3>
          </header>
          <div className="fama-card fama-empty">
            <p className="fama-display fama-empty-title">Sin desglose por país</p>
            <p className="fama-quiet">
              La sincronización todavía no trae países. Cuando exista esa lectura, aquí verás el ranking.
            </p>
          </div>
        </section>

        <section id="plan" className="fama-section fama-rise">
          <header className="fama-section-head">
            <p className="fama-kicker">Recorrido</p>
            <h3 className="fama-display fama-section-title">Plan del lanzamiento</h3>
            <p className="fama-quiet">Fechas públicas del video. No inventamos fases futuras.</p>
          </header>
          <div className="fama-plan">
            <article className="fama-card fama-plan-col">
              <p className="fama-kicker">De dónde venimos</p>
              {past.length === 0 ? (
                <p className="fama-quiet">Todavía no hay fases anteriores a hoy.</p>
              ) : (
                <ol className="fama-timeline">
                  {past.map((phase) => (
                    <li key={`${phase.date}-${phase.title}`}>
                      <time dateTime={phase.date}>{formatFullDay(phase.date)}</time>
                      <strong>{phase.title}</strong>
                      <span>{phase.detail}</span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
            <article className="fama-card fama-plan-col is-now">
              <p className="fama-kicker">Dónde estamos</p>
              <p className="fama-display fama-plan-today">{formatFullDay(today)}</p>
              <p className="fama-quiet">
                {selected
                  ? `Hoy seguimos en ${selected.song}${selected.piece ? ` · ${selected.piece}` : ''}.`
                  : 'Sin lanzamiento seleccionado.'}
              </p>
              <p className="fama-corte">{corte}</p>
            </article>
            <article className="fama-card fama-plan-col">
              <p className="fama-kicker">A dónde vamos</p>
              {upcoming.length === 0 ? (
                <>
                  <p className="fama-display fama-empty-title">Pendiente</p>
                  <p className="fama-quiet">Las siguientes fases del plan todavía no tienen fecha.</p>
                </>
              ) : (
                <ol className="fama-timeline">
                  {upcoming.map((phase) => (
                    <li key={`${phase.date}-${phase.title}`}>
                      <time dateTime={phase.date}>{formatFullDay(phase.date)}</time>
                      <strong>{phase.title}</strong>
                      <span>{phase.detail}</span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          </div>
        </section>
      </div>
    </div>
  )
}

function platformLabel(platform: PaidPlatform) {
  if (platform === 'google_youtube') return 'YouTube'
  if (platform === 'meta') return 'Meta'
  return 'TikTok'
}
