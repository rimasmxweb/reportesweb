import Link from 'next/link'
import {
  ADS_PLATFORM_LABEL,
  RELEASE_STATUS_LABEL,
  RELEASE_TYPE_LABEL,
  getReleasesForArtist,
} from '@/lib/releases'

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

export default function ReleasesSection({ artistSlug }: { artistSlug: string }) {
  const releases = getReleasesForArtist(artistSlug)
  if (releases.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-6 pt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-8 shrink-0 rounded-full" style={{ background: 'var(--grad-encendido-h)' }} />
        <div className="leading-none">
          <h2 className="text-[#0a0a0b] text-2xl font-extrabold uppercase tracking-wide" style={C}>
            Releases
          </h2>
          <p className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold mt-1.5" style={C}>
            Catálogo del artista
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {releases.map((release) => (
          <Link
            key={release.slug}
            href={`/dashboard/${artistSlug}/${release.slug}`}
            className="group bg-white border border-[#e6e6e8] rounded-2xl p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5 hover:border-[#E8192C]/40 transition-all duration-300"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[#9b9ba3] text-[10px] uppercase tracking-[0.18em] font-bold" style={C}>
                {RELEASE_TYPE_LABEL[release.type]}
              </span>
              {release.status && (
                <span
                  className="inline-flex items-center text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-widest font-bold text-green-700 bg-green-50 border-green-200"
                  style={C}
                >
                  {release.status === 'active' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block mr-1" />
                  )}
                  {RELEASE_STATUS_LABEL[release.status]}
                </span>
              )}
            </div>

            <h3 className="text-[#0a0a0b] text-2xl sm:text-3xl font-extrabold uppercase tracking-wide leading-none" style={C}>
              {release.title}
            </h3>

            {release.adsPlatforms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {release.adsPlatforms.map((platform) => (
                  <span
                    key={platform}
                    className="text-[10px] uppercase tracking-widest font-bold text-[#5b5b63] bg-[#f4f4f5] border border-[#e6e6e8] rounded-full px-2.5 py-1"
                    style={C}
                  >
                    {ADS_PLATFORM_LABEL[platform]}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-4 text-[#E8192C] text-[11px] uppercase tracking-[0.18em] font-bold" style={C}>
              Ver release →
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
