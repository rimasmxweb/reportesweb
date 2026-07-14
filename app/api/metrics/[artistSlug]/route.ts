import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getArtistBySlug } from '@/lib/config'
import { getArtistMetrics } from '@/lib/campaignData'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { artistSlug } = await params
  const artist = getArtistBySlug(artistSlug)

  if (!artist || !session.artistIds.includes(artist.id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')

  // Rango personalizado (from/to en YYYY-MM-DD) o preset de días
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  let dateFrom: string
  let dateTo: string | null = null
  if (fromParam && toParam && DATE_RE.test(fromParam) && DATE_RE.test(toParam)) {
    dateFrom = fromParam <= toParam ? fromParam : toParam
    dateTo = fromParam <= toParam ? toParam : fromParam
  } else {
    const days = parseInt(searchParams.get('days') ?? '7')
    dateFrom = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  }

  try {
    const metrics = await getArtistMetrics(artist, dateFrom, platform, dateTo)
    return NextResponse.json({
      artist: { id: artist.id, name: artist.name, slug: artist.slug },
      metrics,
    })
  } catch (err) {
    console.error('[api/metrics]', err)
    return NextResponse.json({ error: 'Error consultando métricas' }, { status: 502 })
  }
}
