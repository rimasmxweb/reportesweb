import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createSession, setSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { code } = await request.json()

  if (!code) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: pm, error } = await supabase
    .from('project_managers')
    .select('id, name, email')
    .eq('access_code', code.trim().toUpperCase())
    .single()

  if (error || !pm) {
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
  }

  const { data: pmArtists } = await supabase
    .from('pm_artists')
    .select('artist_id')
    .eq('pm_id', pm.id)

  const artistIds = pmArtists?.map((r) => r.artist_id) ?? []

  const token = await createSession({
    pmId: pm.id,
    pmName: pm.name,
    artistIds,
  })

  await setSessionCookie(token)

  return NextResponse.json({ ok: true, name: pm.name })
}
