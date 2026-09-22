import Link from 'next/link'
import { getReleasesForArtist, releaseTypeLabel } from '@/lib/releases'

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

export default function ReleaseStrip({ artistSlug }: { artistSlug: string }) {
  const releases = getReleasesForArtist(artistSlug)
  if (releases.length === 0) return null

  const allSingles = releases.every((release) => release.type === 'single')
  const countLabel = allSingles
    ? releases.length === 1 ? 'sencillo' : 'sencillos'
    : releases.length === 1 ? 'lanzamiento' : 'lanzamientos'

  return (
    <section className="max-w-6xl mx-auto px-6 pt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-7 bg-[#E8192C] rounded-full" />
        <h2 className="text-[#0a0a0b] text-2xl font-black uppercase tracking-wide" style={C}>
          Lanzamientos
        </h2>
        <span className="text-[#9b9ba3] text-sm" style={C}>
          {releases.length} {countLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {releases.map((release) => (
          <Link
            key={release.slug}
            href={`/dashboard/${artistSlug}/${release.slug}`}
            className="group bg-white border border-[#e6e6e8] rounded-2xl px-5 py-4 shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:border-[#E8192C]/50 hover:shadow-[var(--shadow-lift)] active:scale-[0.99] transition-all"
          >
            <span
              className="inline-block bg-[#E8192C] text-white px-2 py-0.5 -skew-x-6 text-[10px] uppercase tracking-[0.3em] font-bold"
              style={C}
            >
              {releaseTypeLabel(release.type)}
            </span>
            <h3
              className="mt-3 text-[#0a0a0b] text-3xl font-black uppercase leading-[0.95] tracking-tight group-hover:text-[#E8192C] transition-colors"
              style={C}
            >
              {release.title}
            </h3>
            <p className="mt-3 text-[#9b9ba3] text-xs uppercase tracking-widest font-bold group-hover:text-[#0a0a0b] transition-colors" style={C}>
              Ver campañas
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
