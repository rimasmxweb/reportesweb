import Image from 'next/image'
import { Outfit, Unbounded } from 'next/font/google'
import { redirect } from 'next/navigation'
import { formatCount, mexicoToday } from '@/lib/famaFormat'
import { FAMA_HERO_VIDEO_ID, campaignDayCount, shortMexicoDate } from '@/lib/famaHero'
import type { FamaReleaseCard } from '@/lib/famaTypes'

const body = Outfit({
  subsets: ['latin'],
  variable: '--font-fama-body',
  display: 'swap',
})

const display = Unbounded({
  subsets: ['latin'],
  variable: '--font-fama-display',
  display: 'swap',
})

export default function FamaView({ releases }: { releases: FamaReleaseCard[] }) {
  async function logout() {
    'use server'
    const { clearSession } = await import('@/lib/auth')
    const { previewLandingPath, previewSkipsAccessGate } = await import('@/lib/previewAccess')
    await clearSession()
    // Temporal: en preview, salir no vuelve a la pantalla de código.
    redirect(previewSkipsAccessGate() ? previewLandingPath() : '/login')
  }

  const hero = releases.find((release) => release.youtubeVideoId === FAMA_HERO_VIDEO_ID) ?? null
  const updated = shortMexicoDate(hero?.publicViewsFetchedAt ?? null)
  const days = hero ? campaignDayCount(hero.campaignStart, mexicoToday()) : null
  const cards = [...releases].sort((a, b) => {
    if (a.youtubeVideoId === FAMA_HERO_VIDEO_ID) return -1
    if (b.youtubeVideoId === FAMA_HERO_VIDEO_ID) return 1
    return a.campaignStart.localeCompare(b.campaignStart)
  })

  return (
    <div className={`fama-shell ${body.variable} ${display.variable}`}>
      <header className="fama-header">
        <Image src="/logo-rimas.png" alt="Rimas" width={90} height={22} priority style={{ height: 'auto', width: 'auto' }} />
        <form action={logout}>
          <button type="submit" className="fama-header-link">
            Salir
          </button>
        </form>
      </header>

      <main className="fama-main">
        <section className="fama-hero-card">
          <p className="fama-display fama-hero-number">
            {hero?.publicViews == null ? 'Pendiente' : formatCount(hero.publicViews)}
          </p>
          <p className="fama-hero-label">
            {updated ? `Vistas públicas · actualizado ${updated}` : 'Vistas públicas'}
          </p>
          <a
            className="fama-video-link"
            href={`https://www.youtube.com/watch?v=${FAMA_HERO_VIDEO_ID}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver el video
          </a>
        </section>

        {days != null && days >= 0 && (
          <p className="fama-days">{days === 1 ? '1 día' : `${days.toLocaleString('es-MX')} días`}</p>
        )}

        <section className="fama-cards">
          {cards.map((release) => (
            <article key={release.slug} className="fama-release-card">
              <p className="fama-release-name">{release.title}</p>
              <p className="fama-display fama-release-number">
                {release.publicViews == null ? 'Pendiente' : formatCount(release.publicViews)}
              </p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
