import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { getArtistBySlug } from '@/lib/config'
import { getLatestActiveRelease, getRelease, getReleasesForArtist, releaseTypeLabel } from '@/lib/releases'
import { displayPublicViews, readStoredPublicViews } from '@/lib/publicViews'
import Link from 'next/link'
import Image from 'next/image'
import ReleaseMarketing from '../ReleaseMarketing'
import { photoSrc } from '@/lib/artistPhotos'

const CONDENSED = { fontFamily: "'Barlow Condensed', sans-serif" }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ artistSlug: string; releaseSlug: string }>
}): Promise<Metadata> {
  const session = await getSession()
  const { artistSlug, releaseSlug } = await params
  const artist = getArtistBySlug(artistSlug)
  const release = artist ? getRelease(artist.slug, releaseSlug) : undefined
  if (!session || !artist || !release || !session.artistIds.includes(artist.id)) {
    return { title: 'Rimas MX' }
  }
  return { title: `${release.title} — ${artist.name} · Rimas MX` }
}

export default async function ReleaseDashboardPage({
  params,
}: {
  params: Promise<{ artistSlug: string; releaseSlug: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { artistSlug, releaseSlug } = await params
  const artist = getArtistBySlug(artistSlug)
  const release = artist ? getRelease(artist.slug, releaseSlug) : undefined

  if (!artist || !release || !session.artistIds.includes(artist.id)) notFound()

  const artistReleases = getReleasesForArtist(artist.slug)
  const storedViews = await readStoredPublicViews(artistReleases.map((item) => item.id))

  const photo = photoSrc(artistSlug)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
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
            Perfil
          </Link>

          <span className="text-[#3a3a3a] text-lg shrink-0">/</span>

          <Link
            href={`/dashboard/${artist.slug}`}
            className="link-sweep text-[#888] hover:text-white text-xs sm:text-sm uppercase tracking-wide font-black truncate pb-0.5"
            style={CONDENSED}
          >
            {artist.name}
          </Link>

          <span className="text-[#3a3a3a] text-lg shrink-0">/</span>

          <h1 className="text-white text-sm sm:text-base font-black uppercase tracking-wide truncate" style={CONDENSED}>
            {release.title}
          </h1>
        </div>

        <span className="text-[#888] text-xs hidden sm:inline shrink-0" style={CONDENSED}>{session.pmName}</span>
      </header>

      {photo && (
        <div className="relative h-44 sm:h-64 overflow-hidden">
          <Image
            src={photo}
            alt={release.title}
            fill
            sizes="100vw"
            className="object-cover object-top"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f4f4f5] via-transparent to-transparent" />
          <div
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
            }}
          />
          <div className="absolute inset-0 flex items-end px-4 sm:px-8 pb-5 sm:pb-6">
            <div className="animate-rise">
              <span
                className="inline-block bg-[#E8192C] text-white px-2 py-0.5 -skew-x-6 text-[10px] uppercase tracking-[0.3em] font-bold mb-1.5"
                style={CONDENSED}
              >
                {releaseTypeLabel(release.type)}
              </span>
              <p className="text-white/70 text-xs uppercase tracking-[0.28em] font-bold mb-1" style={CONDENSED}>
                {artist.name}
              </p>
              <h2 className="text-white text-4xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tight" style={CONDENSED}>
                {release.title}
              </h2>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--grad-encendido-h)' }} />
        </div>
      )}

      <ReleaseMarketing
        key={release.slug}
        artistSlug={artist.slug}
        releases={artistReleases.map((item) => ({
          slug: item.slug,
          title: item.title,
          typeLabel: releaseTypeLabel(item.type),
          active: item.active,
          campaignStart: item.campaignStart,
          ...displayPublicViews(item, storedViews.get(item.id)),
        }))}
        selectedSlug={release.slug}
        latestActiveSlug={getLatestActiveRelease(artist.slug)?.slug ?? null}
      />
    </div>
  )
}
