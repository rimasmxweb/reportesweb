import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import MetricsDashboard from './MetricsDashboard'

const CONDENSED = { fontFamily: "'Barlow Condensed', sans-serif" }

export default async function ArtistDashboardPage({
  params,
}: {
  params: Promise<{ artistSlug: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { artistSlug } = await params
  const supabase = createServiceClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, name, slug')
    .eq('slug', artistSlug)
    .single()

  if (!artist || !session.artistIds.includes(artist.id)) notFound()

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Red top bar */}
      <div className="h-1 w-full bg-[#E8192C]" />

      <header className="border-b border-[#141414] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Image src="/logo-rimas.png" alt="Rimas" width={90} height={22} priority />
          </Link>

          <span className="text-[#2a2a2a] text-lg">/</span>

          <Link
            href="/dashboard"
            className="text-[#444] hover:text-white text-xs uppercase tracking-widest transition-colors"
            style={CONDENSED}
          >
            Artistas
          </Link>

          <span className="text-[#2a2a2a] text-lg">/</span>

          <h1
            className="text-white text-base font-black uppercase tracking-wide"
            style={CONDENSED}
          >
            {artist.name}
          </h1>
        </div>

        <span className="text-[#333] text-xs">{session.pmName}</span>
      </header>

      <MetricsDashboard artistSlug={artistSlug} artistName={artist.name} />
    </div>
  )
}
