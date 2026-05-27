import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  google_youtube: { label: 'YouTube',  color: 'border-[#FF0000]/30 text-[#FF0000] bg-[#FF0000]/5' },
  meta:           { label: 'Meta',     color: 'border-[#1877F2]/30 text-[#1877F2] bg-[#1877F2]/5' },
  tiktok:         { label: 'TikTok',   color: 'border-white/20 text-white bg-white/5' },
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServiceClient()

  const { data: artists } = await supabase
    .from('artists')
    .select('id, name, slug, campaigns (platform)')
    .in('id', session.artistIds)
    .eq('active', true)
    .order('name')

  async function logout() {
    'use server'
    const { clearSession } = await import('@/lib/auth')
    await clearSession()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Red top bar */}
      <div className="h-1 w-full bg-[#E8192C]" />

      {/* Header */}
      <header className="border-b border-[#141414] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image src="/logo-rimas.png" alt="Rimas" width={100} height={25} priority />
          <span className="text-[#333] text-xs mx-1">|</span>
          <span className="text-[#666] text-xs uppercase tracking-widest">Campaign Dashboard</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[#666] text-xs">
            {session.pmName}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-[#444] hover:text-[#E8192C] transition-colors uppercase tracking-widest"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12">
        {/* Section title */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-1 h-6 bg-[#E8192C]" />
          <h1
            className="text-white text-3xl font-black uppercase tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Tus Artistas
          </h1>
          <span className="text-[#333] text-sm ml-2">
            {artists?.length ?? 0} activos
          </span>
        </div>

        {!artists || artists.length === 0 ? (
          <div className="border border-[#1a1a1a] rounded-sm p-12 text-center">
            <p className="text-[#444] text-sm uppercase tracking-widest">
              No hay artistas asignados
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artists.map((artist) => {
              const platforms = [...new Set(
                artist.campaigns?.map((c: { platform: string }) => c.platform) ?? []
              )]
              return (
                <Link
                  key={artist.id}
                  href={`/dashboard/${artist.slug}`}
                  className="group relative block border border-[#1a1a1a] hover:border-[#E8192C]/40 bg-[#0a0a0a] hover:bg-[#0f0f0f] rounded-sm p-6 transition-all duration-200"
                >
                  {/* Red left accent on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#E8192C] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-sm" />

                  <div className="flex items-start justify-between mb-5">
                    <h3
                      className="text-white text-2xl font-black uppercase leading-tight group-hover:text-[#E8192C] transition-colors"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {artist.name}
                    </h3>
                    <span className="text-[#333] group-hover:text-[#E8192C] transition-colors text-lg mt-1">
                      →
                    </span>
                  </div>

                  {platforms.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map((p) => {
                        const style = PLATFORM_STYLES[p as string]
                        return (
                          <span
                            key={p as string}
                            className={`text-[10px] px-2 py-0.5 rounded-sm border uppercase tracking-widest font-bold ${style?.color ?? 'border-[#333] text-[#666] bg-transparent'}`}
                            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                          >
                            {style?.label ?? p as string}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-[#333] text-[10px] uppercase tracking-widest">
                      Sin campañas activas
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
