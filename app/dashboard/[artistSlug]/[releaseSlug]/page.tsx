import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getArtistBySlug } from '@/lib/config'
import {
  ADS_PLATFORM_LABEL,
  RELEASE_STATUS_LABEL,
  RELEASE_TYPE_LABEL,
  getRelease,
} from '@/lib/releases'
import Link from 'next/link'
import Image from 'next/image'
import { photoSrc } from '@/lib/artistPhotos'
import ReleaseDashboard from './ReleaseDashboard'

const CONDENSED = { fontFamily: "'Barlow Condensed', sans-serif" }

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ artistSlug: string; releaseSlug: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { artistSlug, releaseSlug } = await params
  const artist = getArtistBySlug(artistSlug)
  if (!artist || !session.artistIds.includes(artist.id)) notFound()

  const release = getRelease(artistSlug, releaseSlug)
  if (!release) notFound()

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
            Artistas
          </Link>

          <span className="text-[#3a3a3a] text-lg shrink-0">/</span>

          <Link
            href={`/dashboard/${artist.slug}`}
            className="link-sweep text-[#888] hover:text-white text-sm sm:text-base font-black uppercase tracking-wide truncate pb-0.5"
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

      <div className="relative h-40 sm:h-52 overflow-hidden bg-[#0a0a0b]">
        {photo && (
          <Image
            src={photo}
            alt={artist.name}
            fill
            sizes="100vw"
            className="object-cover object-top opacity-80"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f4f4f5] via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-end px-4 sm:px-8 pb-5 sm:pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="inline-block bg-[#E8192C] text-white px-2 py-0.5 -skew-x-6 text-[10px] uppercase tracking-[0.3em] font-bold"
                style={CONDENSED}
              >
                {RELEASE_TYPE_LABEL[release.type]}
              </span>
              {release.status && (
                <span className="text-white/80 text-[10px] uppercase tracking-[0.22em] font-bold" style={CONDENSED}>
                  {RELEASE_STATUS_LABEL[release.status]}
                </span>
              )}
              {release.adsPlatforms.map((platform) => (
                <span
                  key={platform}
                  className="text-white/80 text-[10px] uppercase tracking-[0.18em] font-bold border border-white/25 rounded-full px-2 py-0.5"
                  style={CONDENSED}
                >
                  {ADS_PLATFORM_LABEL[platform]}
                </span>
              ))}
            </div>
            <h2 className="text-white text-4xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tight" style={CONDENSED}>
              {release.title}
            </h2>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--grad-encendido-h)' }} />
      </div>

      <ReleaseDashboard
        artistSlug={artist.slug}
        artistName={artist.name}
        releaseSlug={release.slug}
        releaseTitle={release.title}
      />
    </div>
  )
}
