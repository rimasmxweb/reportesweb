import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getArtists } from '@/lib/config'
import { getActivePlatformsByArtist } from '@/lib/campaignData'
import Image from 'next/image'
import { photoSrc } from '@/lib/artistPhotos'
import ArtistGrid from './ArtistGrid'
import LaserBar from '../components/LaserBar'

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const artists = getArtists().filter((a) => session.artistIds.includes(a.id))

  let platformsByArtist = new Map<string, Set<string>>()
  try {
    platformsByArtist = await getActivePlatformsByArtist()
  } catch (err) {
    console.error('[dashboard] no se pudieron cargar plataformas activas:', err)
  }

  const artistData = artists
    .map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      photo: photoSrc(a.slug),
      platforms: [...(platformsByArtist.get(a.id) ?? [])],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function logout() {
    'use server'
    const { clearSession } = await import('@/lib/auth')
    await clearSession()
    redirect('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <LaserBar />

      <header className="sticky top-0 z-50 bg-[#0a0a0b] sm:bg-[#0a0a0b]/90 sm:backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Image src="/logo-rimas.png" alt="Rimas" width={90} height={22} priority style={{ height: 'auto', width: 'auto' }} className="w-20 sm:w-[100px]" />
          <span className="text-[#3a3a3a] text-xs mx-1 hidden sm:inline">|</span>
          <span className="text-[#888] text-xs uppercase tracking-widest hidden sm:inline" style={C}>Campaign Dashboard</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <span className="text-[#888] text-xs hidden sm:inline truncate max-w-[140px]" style={C}>{session.pmName}</span>
          <form action={logout}>
            <button
              type="submit"
              className="link-sweep text-xs text-[#888] hover:text-white transition-colors uppercase tracking-widest pb-0.5"
              style={C}
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="w-1 h-7 bg-[#E8192C] rounded-full" />
          <h1 className="text-[#0a0a0b] text-2xl sm:text-3xl font-black uppercase tracking-wide" style={C}>
            Tus Artistas
          </h1>
          <span className="text-[#9b9ba3] text-sm ml-1" style={C}>
            {artistData.length} activos
          </span>
        </div>

        {artistData.length === 0 ? (
          <div className="border border-[#e6e6e8] bg-white rounded-xl p-12 text-center">
            <p className="text-[#9b9ba3] text-sm uppercase tracking-widest" style={C}>
              No hay artistas asignados
            </p>
          </div>
        ) : (
          <ArtistGrid artists={artistData} />
        )}
      </main>
    </div>
  )
}
