import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getArtistBySlug } from '@/lib/config'
import Link from 'next/link'
import Image from 'next/image'
import MetricsDashboard from './MetricsDashboard'
import { photoSrc } from '@/lib/artistPhotos'

const CONDENSED = { fontFamily: "'Barlow Condensed', sans-serif" }

export default async function ArtistDashboardPage({
  params,
}: {
  params: Promise<{ artistSlug: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { artistSlug } = await params
  const artist = getArtistBySlug(artistSlug)

  if (!artist || !session.artistIds.includes(artist.id)) notFound()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* Black header bar holds the white logo */}
      <header className="sticky top-0 z-50 bg-[#0a0a0b] sm:bg-[#0a0a0b]/90 sm:backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/dashboard" className="shrink-0">
            <Image src="/logo-rimas.png" alt="Rimas" width={90} height={22} priority style={{ height: 'auto', width: 'auto' }} className="w-[74px] sm:w-[90px]" />
          </Link>

          <span className="text-[#3a3a3a] text-lg hidden sm:inline">/</span>

          <Link
            href="/dashboard"
            className="link-sweep text-[#888] hover:text-white text-xs uppercase tracking-widest transition-colors hidden sm:inline pb-0.5"
            style={CONDENSED}
          >
            Artistas
          </Link>

          <span className="text-[#3a3a3a] text-lg shrink-0">/</span>

          <h1 className="text-white text-sm sm:text-base font-black uppercase tracking-wide truncate" style={CONDENSED}>
            {artist.name}
          </h1>
        </div>

        <span className="text-[#888] text-xs hidden sm:inline shrink-0" style={CONDENSED}>{session.pmName}</span>
      </header>

      {/* Artist hero banner */}
      {photoSrc(artistSlug) && (
        <div className="relative h-44 sm:h-64 overflow-hidden">
          <Image
            src={photoSrc(artistSlug)!}
            alt={artist.name}
            fill
            sizes="100vw"
            className="object-cover object-top"
            priority
          />
          {/* Left-to-right gradient: solid black fades into transparent */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
          {/* Bottom fade blends into the light page */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f4f4f5] via-transparent to-transparent" />
          {/* Grano de portada de disco */}
          <div
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
            }}
          />
          {/* Artist name */}
          <div className="absolute inset-0 flex items-end px-4 sm:px-8 pb-5 sm:pb-6">
            <div className="animate-rise">
              <span
                className="inline-block bg-[#E8192C] text-white px-2 py-0.5 -skew-x-6 text-[10px] uppercase tracking-[0.3em] font-bold mb-1.5"
                style={CONDENSED}
              >
                Rimas MX
              </span>
              <h2 className="text-white text-5xl sm:text-7xl font-black uppercase leading-[0.9] tracking-tight" style={CONDENSED}>
                {artist.name}
              </h2>
            </div>
          </div>
          {/* Filo encendido */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--grad-encendido-h)' }} />
        </div>
      )}

      <MetricsDashboard artistSlug={artistSlug} artistName={artist.name} />
    </div>
  )
}
