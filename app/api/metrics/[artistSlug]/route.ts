import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { artistSlug } = await params
  const supabase = createServiceClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, name, slug')
    .eq('slug', artistSlug)
    .single()

  if (!artist || !session.artistIds.includes(artist.id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7')
  const platform = searchParams.get('platform')

  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)

  let query = supabase
    .from('campaign_metrics')
    .select(`
      *,
      campaigns!inner (
        id, name, platform, youtube_type, status, budget_total, artist_id
      )
    `)
    .eq('campaigns.artist_id', artist.id)
    .gte('date', dateFrom.toISOString().split('T')[0])
    .order('date', { ascending: false })

  if (platform) {
    query = query.eq('campaigns.platform', platform)
  }

  const { data: metrics } = await query

  const filteredMetrics = platform
    ? metrics?.filter((m) => m.campaigns?.platform === platform)
    : metrics

  return NextResponse.json({ artist, metrics: filteredMetrics ?? [] })
}
