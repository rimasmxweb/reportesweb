'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Artist = {
  id: string
  name: string
  slug: string
  platforms: string[]
  photo: string | null
}

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

const PLATFORM_LABEL: Record<string, string> = {
  google_youtube: 'YouTube',
  meta: 'Meta',
  tiktok: 'TikTok',
}

function normalize(s: string) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function ArtistGrid({ artists }: { artists: Artist[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return artists
    return artists.filter((a) => normalize(a.name).includes(q))
  }, [artists, query])

  return (
    <div>
      {/* Buscador */}
      <div className="mb-5 max-w-md">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b9ba3] text-sm pointer-events-none">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar artista…"
            className="w-full bg-white border border-[#e6e6e8] text-[#0a0a0b] placeholder-[#9b9ba3] rounded-full pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-[#E8192C] focus:shadow-[var(--shadow-red-halo)] transition-all"
            style={C}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b9ba3] hover:text-[#E8192C] text-sm"
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <p className="text-[#9b9ba3] text-xs mt-1.5 ml-4" style={C}>
            Mostrando {filtered.length} de {artists.length}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-[#e6e6e8] bg-white rounded-2xl p-10 text-center shadow-[var(--shadow-card)]">
          <p className="text-[#9b9ba3] text-sm uppercase tracking-widest" style={C}>
            Sin resultados para “{query}”
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((artist, index) => (
            <Link
              key={artist.id}
              href={`/dashboard/${artist.slug}`}
              className="group relative aspect-[4/5] rounded-[20px] overflow-hidden bg-[#1a1a1a] block hover:-translate-y-1 hover:ring-2 hover:ring-[#E8192C]/60 active:scale-[0.98] transition-all duration-300 animate-rise"
              style={{ '--stagger': Math.min(index, 10) } as React.CSSProperties}
            >
              {artist.photo ? (
                <Image
                  src={artist.photo}
                  alt={artist.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'var(--grad-encendido)' }}
                >
                  <span className="text-7xl font-black text-white/90" style={C}>
                    {artist.name.charAt(0)}
                  </span>
                </div>
              )}

              {/* Gradiente de legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* Contenido */}
              <div className="absolute bottom-0 inset-x-0 p-3">
                <p
                  className="text-white text-2xl font-black uppercase leading-none group-hover:text-[#FF5A3C] transition-colors"
                  style={C}
                >
                  {artist.name}
                </p>
                {artist.platforms.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {artist.platforms.map((p) => (
                      <span
                        key={p}
                        className="bg-white/15 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold"
                        style={C}
                      >
                        {PLATFORM_LABEL[p] ?? p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-white/50 text-[10px] uppercase tracking-widest" style={C}>
                    Sin campañas
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
