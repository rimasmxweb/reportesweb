import Image from 'next/image'
import Link from 'next/link'
import { Outfit, Unbounded } from 'next/font/google'
import { redirect } from 'next/navigation'
import FamaDashboard from './FamaDashboard'
import { mexicoToday } from '@/lib/famaFormat'
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

export default function FamaView({
  artistName,
  artistSlug,
  pmName,
  photo,
  releases,
  selectedSlug,
  latestActiveSlug,
  crumb,
}: {
  artistName: string
  artistSlug: string
  pmName: string
  photo: string | null
  releases: FamaReleaseCard[]
  selectedSlug: string
  latestActiveSlug: string | null
  crumb: string | null
}) {
  async function logout() {
    'use server'
    const { clearSession } = await import('@/lib/auth')
    await clearSession()
    redirect('/login')
  }

  return (
    <div className={`fama-shell ${body.variable} ${display.variable}`}>
      <header className="fama-header">
        <div className="fama-header-brand">
          <Link href="/dashboard" className="fama-logo">
            <Image src="/logo-rimas.png" alt="Rimas" width={90} height={22} priority style={{ height: 'auto', width: 'auto' }} />
          </Link>
          <Link href="/dashboard" className="fama-header-link">
            Perfil
          </Link>
          <Link href={`/dashboard/${artistSlug}`} className="fama-header-link is-strong">
            {artistName}
          </Link>
          {crumb && <span className="fama-header-crumb">{crumb}</span>}
        </div>
        <div className="fama-header-side">
          <span className="fama-header-pm">{pmName}</span>
          <form action={logout}>
            <button type="submit" className="fama-header-link">
              Salir
            </button>
          </form>
        </div>
      </header>

      <FamaDashboard
        key={selectedSlug}
        artistSlug={artistSlug}
        artistName={artistName}
        photo={photo}
        releases={releases}
        selectedSlug={selectedSlug}
        latestActiveSlug={latestActiveSlug}
        today={mexicoToday()}
      />
    </div>
  )
}
